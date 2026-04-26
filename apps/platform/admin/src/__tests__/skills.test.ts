import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import type { SkillSource } from '@teamsuzie/skills';
import { setupTestApp, type TestApp } from './setup.js';
import { SkillsService } from '../services/skills.js';

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
    expect(response.body.items.find((s: { slug: string }) => s.slug === 'hello-world')).toMatchObject({
      source_id: 'local',
      access: 'free',
    });
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

  it('can list skills from an injected source', async () => {
    const hostedSource: SkillSource = {
      id: 'hosted',
      async listSkills() {
        return [
          {
            sourceId: 'hosted',
            skillName: 'premium-research',
            name: 'Premium Research',
            description: 'Hosted catalog example',
            access: 'paid',
            version: '1.2.3',
            publisher: 'Team Suzie',
          },
        ];
      },
      async getSkillBundle() {
        throw new Error('not used by list');
      },
    };

    const service = new SkillsService({
      skillsDir: SkillsService.defaultSkillsDir(),
      sources: [hostedSource],
    });

    await expect(service.list()).resolves.toEqual([
      {
        source_id: 'hosted',
        slug: 'premium-research',
        name: 'Premium Research',
        description: 'Hosted catalog example',
        access: 'paid',
        version: '1.2.3',
        publisher: 'Team Suzie',
        required_context: [],
      },
    ]);
  });
});
