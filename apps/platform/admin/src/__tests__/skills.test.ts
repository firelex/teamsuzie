import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { setupTestApp, type TestApp } from './setup.js';

describe('Phase 2 — skills', () => {
  let harness: TestApp;
  let authed: supertest.Agent;

  beforeAll(async () => {
    harness = await setupTestApp();
    authed = await harness.loginAsAdmin();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('requires auth', async () => {
    await harness.request.get('/api/skill-templates').expect(401);
  });

  it('discovers the shipped SKILL.md templates', async () => {
    const response = await authed.get('/api/skill-templates').expect(200);
    const slugs = response.body.items.map((s: { slug: string }) => s.slug);
    expect(slugs).toEqual(
      expect.arrayContaining(['file-access', 'hello-world', 'documents', 'presentations', 'spreadsheets']),
    );
  });

  it('derives required_context from {{TOKEN}} placeholders', async () => {
    const response = await authed.get('/api/skill-templates').expect(200);
    const docs = response.body.items.find((s: { slug: string }) => s.slug === 'documents');
    expect(docs).toBeDefined();
    expect(docs.required_context).toEqual(
      expect.arrayContaining(['DOCX_AGENT_URL', 'AGENT_API_KEY', 'AGENT_SLUG']),
    );
  });

  it('returns body + metadata on get', async () => {
    const response = await authed.get('/api/skill-templates/presentations').expect(200);
    expect(response.body.skill.body).toContain('Presentations Skill');
    expect(response.body.skill.required_context).toContain('PPTX_AGENT_URL');
  });

  it('returns 404 for unknown slug', async () => {
    await authed.get('/api/skill-templates/not-a-real-skill').expect(404);
  });
});
