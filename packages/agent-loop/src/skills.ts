import {
  HttpSkillSource,
  SkillRegistry,
  type SkillRenderContext,
} from '@teamsuzie/skills';

export interface SkillLoadConfig {
  skillsDir?: string;
  catalogUrl?: string;
  catalogToken?: string;
  /** Render-context map (e.g. { XLSX_AGENT_URL: 'http://...' }) for {{TOKEN}} substitution. */
  renderContext: SkillRenderContext;
  /** Subset of skills to install. Empty/undefined = install all. */
  allow?: string[];
  fetchImpl?: typeof fetch;
}

export interface LoadedSkill {
  skillName: string;
  name: string;
  description: string;
  sourceId: string;
  content: string;
}

export interface SkillLoadResult {
  skills: LoadedSkill[];
  systemPrompt: string;
  /** Hosts derived from URL-shaped values in renderContext. Use to seed the http_request allow-list. */
  derivedHosts: string[];
}

function shouldInclude(skillName: string, allow?: string[]): boolean {
  if (!allow || allow.length === 0) return true;
  return allow.includes(skillName);
}

function deriveHosts(renderContext: SkillRenderContext): string[] {
  const hosts = new Set<string>();
  for (const value of Object.values(renderContext)) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.host) hosts.add(url.host.toLowerCase());
    } catch {
      // value isn't a URL — skip
    }
  }
  return [...hosts];
}

function buildSystemPrompt(skills: LoadedSkill[]): string {
  if (skills.length === 0) return '';

  const intro = [
    'You have access to the following installed skills. Each skill is a markdown',
    'document describing how to perform a capability — typically by calling an',
    'HTTP endpoint via the `http_request` tool. Read the relevant skill carefully',
    'before acting; only the hosts mentioned in skill base URLs are allow-listed.',
  ].join(' ');

  const sections = skills.map(
    (skill) => `\n\n=== SKILL: ${skill.skillName} ===\n${skill.content}\n=== END SKILL: ${skill.skillName} ===`,
  );

  return `${intro}${sections.join('')}`;
}

export async function loadSkills(opts: SkillLoadConfig): Promise<SkillLoadResult> {
  const skills: LoadedSkill[] = [];

  if (opts.skillsDir) {
    const registry = new SkillRegistry({ skillsDir: opts.skillsDir });
    for (const info of registry.listSkills()) {
      if (!shouldInclude(info.skillName, opts.allow)) continue;
      const rendered = registry.renderSkill(info.skillName, opts.renderContext);
      if (!rendered) continue;
      skills.push({
        skillName: info.skillName,
        name: info.name,
        description: info.description,
        sourceId: 'local',
        content: rendered.content,
      });
    }
  }

  if (opts.catalogUrl) {
    const source = new HttpSkillSource({
      baseUrl: opts.catalogUrl,
      authToken: opts.catalogToken,
      fetchImpl: opts.fetchImpl,
    });

    const listings = await source.listSkills();
    for (const listing of listings) {
      if (!shouldInclude(listing.skillName, opts.allow)) continue;
      // Don't double-add a skill present in both the local dir and the remote catalog.
      if (skills.some((s) => s.skillName === listing.skillName)) continue;

      const bundle = await source.getSkillBundle(
        { sourceId: source.id, skillName: listing.skillName, version: listing.version },
        opts.renderContext,
      );
      if (!bundle) continue;

      const skillFile = bundle.files.find((f) => f.file_path.endsWith('SKILL.md'));
      if (!skillFile) continue;

      skills.push({
        skillName: listing.skillName,
        name: listing.name,
        description: listing.description,
        sourceId: source.id,
        content: skillFile.content,
      });
    }
  }

  return {
    skills,
    systemPrompt: buildSystemPrompt(skills),
    derivedHosts: deriveHosts(opts.renderContext),
  };
}
