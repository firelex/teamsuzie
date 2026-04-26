import { MarkdownDocument } from './document.js';

export interface DocumentSummary {
  id: string;
  title: string;
  /** Top-level heading count, useful for quick "outline at a glance". */
  headingCount: number;
  /** Bytes of the markdown body. */
  size: number;
  createdAt: number;
  updatedAt: number;
}

interface Entry {
  doc: MarkdownDocument;
  createdAt: number;
  updatedAt: number;
}

/**
 * Per-session in-memory store of markdown documents. Mirrors the shape of
 * {@link InMemoryFileStore} (per-session map of records). Lost on restart;
 * intended for in-flight chat sessions, not durable storage.
 */
export class InMemoryDocumentStore {
  private bySession: Map<string, Map<string, Entry>> = new Map();

  /**
   * Generate an opaque, sortable id. Slightly less random than a UUID but
   * easy to spot in logs.
   */
  private static nextId(): string {
    return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  put(sessionId: string, doc: MarkdownDocument, id?: string): string {
    let perSession = this.bySession.get(sessionId);
    if (!perSession) {
      perSession = new Map();
      this.bySession.set(sessionId, perSession);
    }
    const docId = id ?? InMemoryDocumentStore.nextId();
    const existing = perSession.get(docId);
    const now = Date.now();
    perSession.set(docId, {
      doc,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    return docId;
  }

  /** Mark a document as updated (call after mutating). */
  touch(sessionId: string, docId: string): void {
    const entry = this.bySession.get(sessionId)?.get(docId);
    if (entry) entry.updatedAt = Date.now();
  }

  get(sessionId: string, docId: string): MarkdownDocument | null {
    return this.bySession.get(sessionId)?.get(docId)?.doc ?? null;
  }

  list(sessionId: string): DocumentSummary[] {
    const perSession = this.bySession.get(sessionId);
    if (!perSession) return [];
    const out: DocumentSummary[] = [];
    for (const [id, entry] of perSession) {
      out.push({
        id,
        title: entry.doc.title,
        headingCount: entry.doc.getHeadings().length,
        size: entry.doc.getMarkdown().length,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  delete(sessionId: string, docId: string): boolean {
    return this.bySession.get(sessionId)?.delete(docId) ?? false;
  }

  clearSession(sessionId: string): void {
    this.bySession.delete(sessionId);
  }
}
