# @teamsuzie/markdown-document

Per-session markdown document store with section-aware navigation and drafting tools, plus ready-to-register agent-loop tool factories.

Two consumer flows share this primitive:

- **Q&A / summarization** — the agent navigates an uploaded document (e.g. a DOCX converted to markdown via `markitdown-agent`). Use `documentNavigationTools` for read-only access.
- **Drafting** — the agent builds up a document section by section, exports to DOCX. Use `documentDraftingTools`.

The data model is identical for both — a markdown string with hierarchical headings — so the same `MarkdownDocument` and `InMemoryDocumentStore` back both flows.

## Quickstart

```ts
import {
  InMemoryDocumentStore,
  MarkdownDocument,
  documentNavigationTools,
  documentDraftingTools,
} from '@teamsuzie/markdown-document';

const store = new InMemoryDocumentStore();

// Q&A flow — load a converted document into the store
const sessionId = 'session-abc';
const docId = store.put(sessionId, new MarkdownDocument(markdownFromUpload, 'NDA — Acme'));

// Build tools for the agent's chat turn
const navTools = documentNavigationTools({
  store,
  getSessionId: () => sessionId,
});
const draftTools = documentDraftingTools({
  store,
  getSessionId: () => sessionId,
  exportToDocx: async ({ markdown, filename }) => {
    // POST to your markitdown-agent /export/docx and return a download URL
    return { downloadUrl: '/api/files/.../download.docx' };
  },
});

// Hand to the agent loop
await runChatTurn({
  agent,
  messages,
  tools: [...builtInTools, ...navTools, ...draftTools],
  toolCtx,
  // ...
});
```

## API

### `MarkdownDocument`

Thin wrapper around a markdown string. All operations re-parse on demand — fine up to a few hundred sections.

| Method | Returns | Notes |
|---|---|---|
| `getMarkdown()` | `string` | Full body |
| `setMarkdown(md)` | `void` | Replace body |
| `getHeadings()` | `Heading[]` | Flat list with numeric paths |
| `getOutline()` | `OutlineNode[]` | Hierarchical tree |
| `findHeading(idOrText)` | `Heading \| null` | Path (`"1.2"`) or text substring (case-insensitive) |
| `readSection(idOrText)` | `{ heading, body } \| null` | Body = markdown between this heading and next same-or-higher level heading |
| `search(query)` | `SearchMatch[]` | Plain-text substring with nearest heading |
| `writeSection(idOrText, body)` | `boolean` | Replace section body, keep heading |
| `appendSection(level, text, body?)` | `Heading` | New section at end |
| `setOutline(headings)` | `void` | Replace document with empty sections |
| `deleteSection(idOrText)` | `boolean` | Heading + body |

Sections are addressed by either their numeric path (`"1.2.3"`) or heading text. The numeric path is **stable across edits** unless you add or remove a section above it; if you need a stable id across edits, store one externally.

### `InMemoryDocumentStore`

`Map<sessionId, Map<docId, doc>>` with `put`/`get`/`list`/`delete`/`clearSession`. `put` returns an opaque `doc_id` (`doc_<base36>_<rand>`) and updates the timestamp; call `touch(sessionId, docId)` after mutating a returned `MarkdownDocument`.

### `documentNavigationTools(opts)` — read-only

Returns: `list_documents`, `get_outline`, `read_section`, `search_document`.

### `documentDraftingTools(opts)` — read+write

Returns: `create_document`, `set_outline`, `write_section`, `append_section`, `revise_section`, `delete_section`. If `opts.exportToDocx` is provided, also returns `export_to_docx`.

## Why a single primitive

The Q&A and drafting flows look superficially different but operate on the same data shape. Splitting into two implementations duplicates the parsing, the path semantics, the search behavior — and any future improvements (parser-backed implementation, persistence, vector indexing per section) only have to land once when the model is shared.

## What this is not

- **Not durable storage.** In-memory, gone on restart. Wire your own `DocumentStore` if you need to survive restarts (the interface is small).
- **Not a CRDT.** Two agents editing the same document race; last write wins. Most chat sessions only have one agent, so this is acceptable.
- **Not a markdown renderer.** Output is markdown text. Render it with whatever your app uses.
