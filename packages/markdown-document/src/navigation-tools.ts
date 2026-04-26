import type { AnyToolDefinition } from '@teamsuzie/agent-loop';
import type { InMemoryDocumentStore } from './store.js';

interface ToolFactoryOptions {
  store: InMemoryDocumentStore;
  /** Resolves the active session id for this turn. */
  getSessionId: () => string;
}

interface DocIdArg {
  doc_id: string;
}

interface ReadSectionArgs extends DocIdArg {
  heading: string;
}

interface SearchArgs extends DocIdArg {
  query: string;
}

/**
 * Read-only tools for an agent navigating one or more markdown documents in
 * the session — built from MarkItDown-converted uploads, drafting docs, or any
 * other source the app puts in the store.
 *
 * Returns a fresh array of {@link ToolDefinition}s; safe to call per chat turn.
 *
 * Use these when the agent needs to *answer questions about* or *summarize* a
 * document. For drafting, also include {@link documentDraftingTools}.
 */
export function documentNavigationTools({ store, getSessionId }: ToolFactoryOptions): AnyToolDefinition[] {
  return [
    {
      name: 'list_documents',
      description:
        'List markdown documents available in this session. Returns id, title, heading count, and size for each. Call this first when the user references "the document" without naming one.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      async execute() {
        const sessionId = getSessionId();
        return { items: store.list(sessionId) };
      },
    },
    {
      name: 'get_outline',
      description:
        'Return the heading hierarchy for a document. Use this to orient before reading, or to answer questions like "what topics does this cover?"',
      parameters: {
        type: 'object',
        properties: {
          doc_id: { type: 'string', description: 'Document id from list_documents.' },
        },
        required: ['doc_id'],
        additionalProperties: false,
      },
      async execute(args: DocIdArg) {
        const doc = store.get(getSessionId(), args.doc_id);
        if (!doc) throw new Error(`Document not found: ${args.doc_id}`);
        return { title: doc.title, outline: doc.getOutline() };
      },
    },
    {
      name: 'read_section',
      description:
        'Read the body of one section by heading text or numeric path (e.g. "1.2" or "Definitions"). Returns the markdown between the heading and the next same-or-higher level heading.',
      parameters: {
        type: 'object',
        properties: {
          doc_id: { type: 'string', description: 'Document id.' },
          heading: {
            type: 'string',
            description: 'Heading text (substring match, case-insensitive) or numeric path like "2.1".',
          },
        },
        required: ['doc_id', 'heading'],
        additionalProperties: false,
      },
      async execute(args: ReadSectionArgs) {
        const doc = store.get(getSessionId(), args.doc_id);
        if (!doc) throw new Error(`Document not found: ${args.doc_id}`);
        const section = doc.readSection(args.heading);
        if (!section) return { found: false };
        return {
          found: true,
          path: section.heading.path,
          level: section.heading.level,
          heading: section.heading.text,
          body: section.body,
        };
      },
    },
    {
      name: 'search_document',
      description:
        'Plain-text search across the document. Returns matching lines with the nearest heading. Prefer this over reading the whole document for keyword-style questions.',
      parameters: {
        type: 'object',
        properties: {
          doc_id: { type: 'string', description: 'Document id.' },
          query: { type: 'string', description: 'Substring to search for (case-insensitive).' },
        },
        required: ['doc_id', 'query'],
        additionalProperties: false,
      },
      async execute(args: SearchArgs) {
        const doc = store.get(getSessionId(), args.doc_id);
        if (!doc) throw new Error(`Document not found: ${args.doc_id}`);
        return { matches: doc.search(args.query).slice(0, 50) };
      },
    },
  ];
}
