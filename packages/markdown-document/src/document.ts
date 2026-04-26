/**
 * Heading metadata extracted from a markdown document.
 */
export interface Heading {
  /** Numeric path: "1", "1.2", "1.2.3" — based on counter-per-level in document order. */
  path: string;
  /** Heading level (1..6) — count of leading `#`s. */
  level: number;
  /** Heading text without `#`s or trailing markers. */
  text: string;
  /** Zero-based line number of the heading in the source. */
  line: number;
}

export interface OutlineNode {
  path: string;
  level: number;
  text: string;
  children: OutlineNode[];
}

export interface SectionRead {
  heading: Heading;
  body: string;
}

export interface SearchMatch {
  /** Zero-based line number where the match was found. */
  line: number;
  /** The full text of the matching line. */
  lineText: string;
  /** The nearest preceding heading, if any. */
  nearestHeading: string | null;
  /** Path of the nearest preceding heading, if any. */
  nearestHeadingPath: string | null;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

/**
 * A working markdown document with section-aware navigation and editing.
 *
 * The class is a thin wrapper around a markdown string. All operations re-parse
 * headings on demand — fine for documents up to a few hundred sections. For
 * heavier workloads, swap to a parser-backed implementation.
 *
 * Sections are addressed by **either** their numeric path (`"1.2.3"`) or their
 * heading text (case-insensitive substring match, falling back to exact when
 * ambiguous). The numeric path is stable across edits *until* you add or remove
 * a section above; if you need stable IDs across edits, store them externally.
 */
export class MarkdownDocument {
  /** Optional title for store/listing purposes. Not part of the markdown body. */
  title: string;
  private md: string;

  constructor(initialMarkdown: string = '', title: string = 'Untitled') {
    this.md = initialMarkdown;
    this.title = title;
  }

  // --- Read -----------------------------------------------------------------

  getMarkdown(): string {
    return this.md;
  }

  setMarkdown(md: string): void {
    this.md = md;
  }

  /** All headings in document order, with hierarchical numeric paths. */
  getHeadings(): Heading[] {
    const lines = this.md.split('\n');
    const out: Heading[] = [];
    const counters: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const m = HEADING_RE.exec(lines[i]);
      if (!m) continue;
      const level = m[1].length;
      const text = m[2];

      counters.length = level;
      counters[level - 1] = (counters[level - 1] ?? 0) + 1;

      const path = counters.filter((n) => n != null).join('.');
      out.push({ path, level, text, line: i });
    }
    return out;
  }

  /** Hierarchical outline (no body content). */
  getOutline(): OutlineNode[] {
    const headings = this.getHeadings();
    const root: OutlineNode = { path: '', level: 0, text: '', children: [] };
    const stack: OutlineNode[] = [root];
    for (const h of headings) {
      while (stack.length > 1 && stack[stack.length - 1].level >= h.level) {
        stack.pop();
      }
      const node: OutlineNode = { path: h.path, level: h.level, text: h.text, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
    return root.children;
  }

  /** Find a heading by numeric path (`"1.2"`) or heading text. */
  findHeading(idOrText: string): Heading | null {
    const headings = this.getHeadings();
    const exactPath = headings.find((h) => h.path === idOrText);
    if (exactPath) return exactPath;
    const exactText = headings.find((h) => h.text.toLowerCase() === idOrText.toLowerCase());
    if (exactText) return exactText;
    const substring = headings.find((h) => h.text.toLowerCase().includes(idOrText.toLowerCase()));
    return substring ?? null;
  }

  /** Read the body (markdown between this heading and the next same-or-higher level heading). */
  readSection(idOrText: string): SectionRead | null {
    const heading = this.findHeading(idOrText);
    if (!heading) return null;
    const headings = this.getHeadings();
    const idx = headings.findIndex((h) => h.line === heading.line);
    const next = headings.slice(idx + 1).find((h) => h.level <= heading.level);

    const lines = this.md.split('\n');
    const start = heading.line + 1;
    const end = next ? next.line : lines.length;
    const body = lines.slice(start, end).join('\n').replace(/^\n+|\n+$/g, '');
    return { heading, body };
  }

  /** Plain-text search across all lines. Case-insensitive substring match. */
  search(query: string): SearchMatch[] {
    if (!query) return [];
    const q = query.toLowerCase();
    const lines = this.md.split('\n');
    const headings = this.getHeadings();
    const matches: SearchMatch[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].toLowerCase().includes(q)) continue;
      let nearest: Heading | null = null;
      for (const h of headings) {
        if (h.line <= i) nearest = h;
        else break;
      }
      matches.push({
        line: i,
        lineText: lines[i],
        nearestHeading: nearest?.text ?? null,
        nearestHeadingPath: nearest?.path ?? null,
      });
    }
    return matches;
  }

  // --- Write ----------------------------------------------------------------

  /**
   * Replace the body of an existing section. The heading line itself is preserved.
   * Returns true on success, false if the section wasn't found.
   */
  writeSection(idOrText: string, body: string): boolean {
    const heading = this.findHeading(idOrText);
    if (!heading) return false;
    const headings = this.getHeadings();
    const idx = headings.findIndex((h) => h.line === heading.line);
    const next = headings.slice(idx + 1).find((h) => h.level <= heading.level);

    const lines = this.md.split('\n');
    const start = heading.line + 1;
    const end = next ? next.line : lines.length;

    const trimmedBody = body.replace(/^\n+|\n+$/g, '');
    const replacement = trimmedBody.length > 0 ? ['', trimmedBody, ''] : [''];
    const newLines = [...lines.slice(0, start), ...replacement, ...lines.slice(end)];
    this.md = newLines.join('\n');
    return true;
  }

  /**
   * Append a new section at the end of the document.
   *
   * `level` is 1..6. `body` is the markdown between this heading and the next
   * (defaults to empty so the agent can fill it later via writeSection).
   */
  appendSection(level: number, heading: string, body: string = ''): Heading {
    if (level < 1 || level > 6) throw new Error(`level must be 1..6, got ${level}`);
    const trimmed = this.md.replace(/\n+$/g, '');
    const prefix = '#'.repeat(level);
    const sep = trimmed.length > 0 ? '\n\n' : '';
    const cleanedBody = body.replace(/^\n+|\n+$/g, '');
    const bodyBlock = cleanedBody ? `\n\n${cleanedBody}` : '';
    this.md = `${trimmed}${sep}${prefix} ${heading}${bodyBlock}\n`;

    // Return the heading metadata for the newly-added section.
    const all = this.getHeadings();
    return all[all.length - 1];
  }

  /**
   * Replace the entire outline at once (overwrites the document with empty
   * sections at the listed headings). Useful for "set TOC, then fill" flows.
   */
  setOutline(headings: ReadonlyArray<{ level: number; text: string }>): void {
    const lines: string[] = [];
    for (const h of headings) {
      if (h.level < 1 || h.level > 6) throw new Error(`level must be 1..6`);
      lines.push(`${'#'.repeat(h.level)} ${h.text}`, '');
    }
    this.md = lines.join('\n').replace(/\n+$/g, '') + '\n';
  }

  /** Delete a section (heading + body). Returns true on success. */
  deleteSection(idOrText: string): boolean {
    const heading = this.findHeading(idOrText);
    if (!heading) return false;
    const headings = this.getHeadings();
    const idx = headings.findIndex((h) => h.line === heading.line);
    const next = headings.slice(idx + 1).find((h) => h.level <= heading.level);

    const lines = this.md.split('\n');
    const start = heading.line;
    const end = next ? next.line : lines.length;
    const newLines = [...lines.slice(0, start), ...lines.slice(end)];
    this.md = newLines.join('\n').replace(/\n{3,}/g, '\n\n');
    return true;
  }
}
