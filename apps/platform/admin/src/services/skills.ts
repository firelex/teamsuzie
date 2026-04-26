import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FilesystemSkillSource, SkillRegistry, type SkillListing, type SkillSource } from '@teamsuzie/skills';

export interface SkillTemplateSummary {
  /** Source id for the catalog that produced this skill. */
  source_id: string;
  /** Directory name — stable identifier. */
  slug: string;
  /** Display name from frontmatter (falls back to slug). */
  name: string;
  description: string;
  access: SkillListing['access'];
  version?: string;
  publisher?: string;
  /** Placeholder tokens (e.g. `AGENT_API_KEY`) referenced in the SKILL.md body. */
  required_context: string[];
}

export interface SkillTemplateDetail extends SkillTemplateSummary {
  /** Raw SKILL.md contents. */
  body: string;
}

const PLACEHOLDER_RE = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

function extractPlaceholders(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_RE.exec(body)) !== null) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/**
 * Backend-side skill service. Delegates discovery/rendering to
 * `@teamsuzie/skills.SkillRegistry`, adds the admin-specific slice
 * (placeholder extraction, summary-vs-detail projection) the UI needs.
 */
export class SkillsService {
  private readonly sources: SkillSource[];
  private readonly localRegistry: SkillRegistry;

  constructor(skillsDir: string);
  constructor(options: { skillsDir: string; sources?: SkillSource[] });
  constructor(input: string | { skillsDir: string; sources?: SkillSource[] }) {
    const skillsDir = typeof input === 'string' ? input : input.skillsDir;
    this.localRegistry = new SkillRegistry({ skillsDir });
    this.sources =
      typeof input === 'string' || !input.sources
        ? [new FilesystemSkillSource({ skillsDir })]
        : input.sources;
  }

  /** Where we resolve the default shipped templates. */
  static defaultSkillsDir(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // Both compiled (admin/dist/services) and tsx-watch (admin/src/services) sit
    // five levels under the repo root, so the same relative path works for both.
    return path.resolve(here, '../../../../../packages/skills/templates');
  }

  async list(): Promise<SkillTemplateSummary[]> {
    const listings = (await Promise.all(this.sources.map((source) => source.listSkills()))).flat();
    return listings.map((info) => {
      const body = this.localRegistry.getSkill(info.skillName) ?? '';
      return {
        source_id: info.sourceId,
        slug: info.skillName,
        name: info.name || info.skillName,
        description: info.description,
        access: info.access,
        version: info.version,
        publisher: info.publisher,
        required_context: extractPlaceholders(body),
      };
    });
  }

  get(slug: string): SkillTemplateDetail | null {
    const body = this.localRegistry.getSkill(slug);
    if (body === null) return null;
    const info = this.localRegistry.listSkills().find((s) => s.skillName === slug);
    if (!info) return null;
    return {
      source_id: 'local',
      slug: info.skillName,
      name: info.name || info.skillName,
      description: info.description,
      access: 'free',
      required_context: extractPlaceholders(body),
      body,
    };
  }
}
