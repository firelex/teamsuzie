# Uploads

Team Suzie OSS does not ship with file-upload routes today. This document
captures the rules any new upload endpoint should follow, and points at the
shared helpers that enforce them.

## Why this exists

Upload handlers are a reliable source of security bugs: path traversal via
unsanitised filenames, storage blowups from missing size caps, arbitrary file
execution from blind extension trust, MIME-type spoofing via client-provided
`Content-Type`. We'd rather not have each new service relearn these.

## Rules

### 1. Size cap

Every route sets an explicit `maxFileSizeBytes`. Do not inherit a framework
default — it tends to be either "16 MB" (too permissive for knowledge bases)
or "no limit" (not a real cap). The shared default is 10 MiB; bump it up only
for routes that truly need it.

### 2. Extension allowlist

Decide which extensions the route accepts, in lowercase, without leading dot.
If the answer is "anything the user uploads," stop — you are building a bug.
The shared default covers docs, images, and common Office formats; trim it
down for narrower routes (e.g. an avatar endpoint should allow `png jpg jpeg
webp` and nothing else).

### 3. Filename normalisation

Never persist the user-provided filename as the storage key. Generate your own
key (UUID, content hash) and store the normalised filename only as metadata
for display. `normalizeUploadFilename` strips path components, repairs common
Latin-1-mis-decoded-UTF-8 mojibake, and removes shell-hostile punctuation.

### 4. Content-Type is advisory

The `Content-Type` the browser sends is a hint, not a fact. A malicious client
can send `image/png` for a PowerShell script. Decisions (allow / deny, which
downstream processor runs) must be based on the extension of the *normalised*
filename. For routes where the file is handed to a downstream renderer, sniff
the first bytes against the expected magic number before forwarding.

### 5. Count cap

`maxFiles` prevents a client from sending 10 000 tiny files in one request to
bypass the size cap or exhaust inodes. Default is 10.

## Using the shared helpers

The helpers live in `packages/shared-auth/src/utils/upload-guard.ts` and are
re-exported from the package root. They do not depend on a specific upload
middleware (multer, formidable, busboy) — pick whichever suits the service
and run the validation over its output.

Example with multer (service would need to add multer as its own dependency):

```ts
import multer from 'multer';
import {
    DEFAULT_UPLOAD_LIMITS,
    normalizeUploadFilename,
    assertUploadLimits,
} from '@teamsuzie/shared-auth';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: DEFAULT_UPLOAD_LIMITS.maxFileSizeBytes,
        files: DEFAULT_UPLOAD_LIMITS.maxFiles,
    },
});

router.post('/api/attachments', upload.any(), (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];

    // Normalise first — assertUploadLimits inspects the extension, and we
    // want that check to run against the safe name, not the raw one.
    for (const file of files) {
        file.originalname = normalizeUploadFilename(file.originalname);
    }

    try {
        assertUploadLimits(files);
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
    }

    // ... store with a generated key, keep file.originalname only as metadata
});
```

Override the defaults per route when the contract is narrower:

```ts
assertUploadLimits(files, {
    maxFileSizeBytes: 2 * 1024 * 1024,
    maxFiles: 1,
    allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'],
});
```

## What the helpers don't do

- **Virus scanning.** If your deployment needs AV, pipe files through
  ClamAV / a managed scanner after `assertUploadLimits` passes and before
  you commit them to durable storage.
- **Image dimension / PDF page limits.** These are format-specific and live
  with the route that processes the file.
- **Per-user / per-org quotas.** Rate limiting and quota accounting is a
  separate concern; use `RateLimitMiddleware` from shared-auth plus your own
  storage-usage table.

## Current upload surfaces in OSS

None. When the first one is added, wire these helpers and update this list.
