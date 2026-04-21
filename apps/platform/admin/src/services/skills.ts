import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillRegistry } from '@teamsuzie/skills';

export interface SkillTemplateSummary {
  /** Directory name — stable identifier. */
  slug: string;
  /** Display name from frontmatter (falls back to slug). */
  name: string;
  description: string;
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
  private readonly registry: SkillRegistry;

  constructor(skillsDir: string) {
    this.registry = new SkillRegistry({ skillsDir });
  }

  /** Where we resolve the default shipped templates. */
  static defaultSkillsDir(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // Both compiled (admin/dist/services) and tsx-watch (admin/src/services) sit
    // five levels under the repo root, so the same relative path works for both.
    return path.resolve(here, '../../../../../packages/skills/templates');
  }

  list(): SkillTemplateSummary[] {
    return this.registry.listSkills().map((info) => {
      const body = this.registry.getSkill(info.skillName) ?? '';
      return {
        slug: info.skillName,
        name: info.name || info.skillName,
        description: info.description,
        required_context: extractPlaceholders(body),
      };
    });
  }

  get(slug: string): SkillTemplateDetail | null {
    const body = this.registry.getSkill(slug);
    if (body === null) return null;
    const info = this.registry.listSkills().find((s) => s.skillName === slug);
    if (!info) return null;
    return {
      slug: info.skillName,
      name: info.name || info.skillName,
      description: info.description,
      required_context: extractPlaceholders(body),
      body,
    };
  }
}
