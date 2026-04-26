import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { type SkillAccess, type SkillBundle, type SkillListing } from '@teamsuzie/skills';

interface SkillManifest {
  name: string;
  description: string;
  version: string;
  access?: SkillAccess;
  publisher?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogDir = path.resolve(__dirname, '../catalog');
const port = Number(process.env.PORT ?? 3021);
const host = process.env.HOST ?? '127.0.0.1';
const sourceId = process.env.SKILL_SOURCE_ID ?? 'external-sample';

function isSafeSlug(slug: string): boolean {
  return /^[a-zA-Z0-9_-]{1,100}$/.test(slug);
}

async function readManifest(slug: string): Promise<SkillManifest | null> {
  if (!isSafeSlug(slug)) return null;
  try {
    const raw = await fs.readFile(path.join(catalogDir, slug, 'skill.json'), 'utf-8');
    return JSON.parse(raw) as SkillManifest;
  } catch {
    return null;
  }
}

async function listSkillSlugs(): Promise<string[]> {
  const entries = await fs.readdir(catalogDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && isSafeSlug(entry.name)).map((entry) => entry.name).sort();
}

async function listSkills(): Promise<SkillListing[]> {
  const listings: SkillListing[] = [];
  for (const slug of await listSkillSlugs()) {
    const manifest = await readManifest(slug);
    if (!manifest) continue;
    listings.push({
      sourceId,
      skillName: slug,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      publisher: manifest.publisher,
      access: manifest.access ?? 'free',
    });
  }
  return listings;
}

async function readBundle(slug: string): Promise<SkillBundle | null> {
  const manifest = await readManifest(slug);
  if (!manifest) return null;

  const rawSkill = await fs.readFile(path.join(catalogDir, slug, 'SKILL.md'), 'utf-8');
  const checksum = crypto.createHash('sha256').update(rawSkill).digest('hex');

  return {
    ref: { sourceId, skillName: slug, version: manifest.version },
    checksum,
    files: [
      {
        file_path: `skills/${slug}/SKILL.md`,
        content: rawSkill,
        content_type: 'markdown',
      },
    ],
  };
}

const app = express();
app.use(helmet());
app.use(cors());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'skill-catalog-host', sourceId });
});

app.get('/skills', async (_req, res, next) => {
  try {
    res.json({ items: await listSkills() });
  } catch (err) {
    next(err);
  }
});

app.get('/skills/:slug', async (req, res, next) => {
  try {
    const bundle = await readBundle(String(req.params.slug));
    if (!bundle) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }
    res.json({ bundle });
  } catch (err) {
    next(err);
  }
});

const server = app.listen(port, host, () => {
  console.log(`[skill-catalog-host] listening on http://${host}:${port}`);
});

server.on('error', (err) => {
  console.error(`[skill-catalog-host] failed to listen: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
