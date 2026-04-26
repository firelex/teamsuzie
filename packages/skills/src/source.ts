import { SkillRegistry } from './registry.js';
import { interpolate } from './interpolate.js';
import type {
    SkillBundle,
    SkillInstallDecision,
    SkillInstallPolicy,
    SkillInstallRequest,
    SkillListing,
    SkillRef,
    SkillRenderContext,
    SkillSource,
    SkillSourceContext,
    SkillTarget,
} from './types.js';

export interface FilesystemSkillSourceOptions {
    sourceId?: string;
    skillsDir: string;
}

export interface HttpSkillSourceOptions {
    sourceId?: string;
    baseUrl: string;
    authToken?: string;
    fetchImpl?: typeof fetch;
}

interface HttpListResponse {
    items?: SkillListing[];
}

interface HttpBundleResponse {
    bundle?: SkillBundle;
}

/**
 * Adapter that exposes the existing on-disk skill registry through the generic
 * source contract used by apps that merge local, community, or hosted catalogs.
 */
export class FilesystemSkillSource implements SkillSource {
    readonly id: string;
    private readonly registry: SkillRegistry;

    constructor(opts: FilesystemSkillSourceOptions) {
        this.id = opts.sourceId ?? 'local';
        this.registry = new SkillRegistry({ skillsDir: opts.skillsDir });
    }

    async listSkills(_context?: SkillSourceContext): Promise<SkillListing[]> {
        return this.registry.listSkills().map((skill) => ({
            ...skill,
            sourceId: this.id,
            access: 'free',
        }));
    }

    async getSkillBundle(
        ref: SkillRef,
        renderContext: SkillRenderContext,
        _context?: SkillSourceContext,
    ): Promise<SkillBundle | null> {
        if (ref.sourceId !== this.id) return null;
        const rendered = this.registry.renderSkill(ref.skillName, renderContext);
        if (!rendered) return null;
        return {
            ref: {
                sourceId: this.id,
                skillName: ref.skillName,
                version: ref.version,
            },
            files: [rendered],
        };
    }
}

export class HttpSkillSource implements SkillSource {
    readonly id: string;
    private readonly baseUrl: string;
    private readonly authToken?: string;
    private readonly fetchImpl: typeof fetch;

    constructor(opts: HttpSkillSourceOptions) {
        this.id = opts.sourceId ?? 'http';
        this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
        this.authToken = opts.authToken;
        this.fetchImpl = opts.fetchImpl ?? fetch;
    }

    async listSkills(context?: SkillSourceContext): Promise<SkillListing[]> {
        const response = await this.request<HttpListResponse>('/skills', context);
        return (response.items ?? []).map((item) => ({
            ...item,
            sourceId: item.sourceId || this.id,
        }));
    }

    async getSkillBundle(
        ref: SkillRef,
        renderContext: SkillRenderContext,
        context?: SkillSourceContext,
    ): Promise<SkillBundle | null> {
        if (ref.sourceId !== this.id) return null;
        const params = new URLSearchParams();
        if (ref.version) params.set('version', ref.version);

        const suffix = params.size > 0 ? `?${params.toString()}` : '';
        const response = await this.request<HttpBundleResponse>(
            `/skills/${encodeURIComponent(ref.skillName)}${suffix}`,
            context,
        );
        const bundle = response.bundle ?? null;
        if (!bundle) return null;
        return {
            ...bundle,
            files: bundle.files.map((file) => ({
                ...file,
                content: interpolate(file.content, renderContext),
            })),
        };
    }

    private async request<T>(path: string, context?: SkillSourceContext): Promise<T> {
        const token = context?.authToken ?? this.authToken;
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
            headers: {
                accept: 'application/json',
                ...(token ? { authorization: `Bearer ${token}` } : {}),
            },
        });

        if (!response.ok) {
            if (response.status === 404) return {} as T;
            throw new Error(`Skill source ${this.id} request failed (${response.status})`);
        }

        return (await response.json()) as T;
    }
}

export const allowAllSkillInstallPolicy: SkillInstallPolicy = {
    async canInstall(_request: SkillInstallRequest): Promise<SkillInstallDecision> {
        return { allowed: true };
    },
};

export interface ApplySkillFromSourceOptions {
    source: SkillSource;
    ref: SkillRef;
    subjectId: string;
    renderContext: SkillRenderContext;
    target: SkillTarget;
    policy?: SkillInstallPolicy;
    context?: SkillSourceContext;
}

export async function applySkillFromSource(opts: ApplySkillFromSourceOptions): Promise<SkillInstallDecision> {
    const policy = opts.policy ?? allowAllSkillInstallPolicy;
    const decision = await policy.canInstall({
        subjectId: opts.subjectId,
        ref: opts.ref,
        context: opts.context,
    });
    if (!decision.allowed) return decision;

    const bundle = await opts.source.getSkillBundle(opts.ref, opts.renderContext, opts.context);
    if (!bundle) {
        return { allowed: false, reason: 'Skill not found' };
    }

    await opts.target.apply(opts.subjectId, bundle.files);
    return decision;
}
