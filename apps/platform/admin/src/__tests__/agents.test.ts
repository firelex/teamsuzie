import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { setupTestApp, type TestApp } from './setup.js';

describe('Phase 1 — agents', () => {
  let harness: TestApp;
  let authed: supertest.Agent;

  beforeAll(async () => {
    harness = await setupTestApp();
    authed = await harness.loginAsAdmin();
  });

  afterAll(async () => {
    await harness.close();
  });

  async function createAgent(body: Record<string, unknown> = {}): Promise<string> {
    const response = await authed
      .post('/api/agents')
      .send({
        name: 'Tester',
        config: { baseUrl: 'http://localhost:18789' },
        ...body,
      })
      .expect(201);
    return response.body.agent.id;
  }

  it('rejects unauthenticated requests with 401', async () => {
    await harness.request.get('/api/agents').expect(401);
  });

  it('lists seeded profiles (Assistant, Researcher)', async () => {
    const response = await authed.get('/api/agent-profiles').expect(200);
    const slugs = response.body.items.map((p: { slug: string }) => p.slug);
    expect(slugs).toEqual(expect.arrayContaining(['assistant', 'researcher']));
  });

  it('creates, fetches, updates, and deletes an agent', async () => {
    const id = await createAgent({ name: 'Scribe', description: 'writes stuff' });

    const got = await authed.get(`/api/agents/${id}`).expect(200);
    expect(got.body.agent).toMatchObject({ id, name: 'Scribe', status: 'active' });

    const updated = await authed
      .put(`/api/agents/${id}`)
      .send({ status: 'suspended', description: 'paused' })
      .expect(200);
    expect(updated.body.agent).toMatchObject({ status: 'suspended', description: 'paused' });

    await authed.delete(`/api/agents/${id}`).expect(200);
    await authed.get(`/api/agents/${id}`).expect(404);
  });

  it('rejects bad input on create with 400', async () => {
    await authed.post('/api/agents').send({}).expect(400);
    await authed
      .post('/api/agents')
      .send({ name: 'x', agent_type: 'not-a-type' })
      .expect(400);
  });

  it('returns 404 on update/delete of an unknown id', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await authed.put(`/api/agents/${fakeId}`).send({ name: 'x' }).expect(404);
    await authed.delete(`/api/agents/${fakeId}`).expect(404);
  });

  it('delete cascades to api keys and workspace files', async () => {
    const agentId = await createAgent({ name: 'Cascade' });

    // Give it a key + a workspace file.
    const keyResponse = await authed
      .post('/api/agent-keys')
      .send({ agent_id: agentId, name: 'smoke' })
      .expect(201);
    expect(keyResponse.body.key).toMatch(/^dtk_/);

    await authed
      .post('/api/workspace/files')
      .send({
        agent_id: agentId,
        file_path: 'notes.md',
        content: '# hi',
        content_type: 'markdown',
      })
      .expect(201);

    // Pre-delete: key + file visible.
    const keysBefore = await authed.get('/api/agent-keys').expect(200);
    expect(keysBefore.body.items.filter((k: { agent_id: string }) => k.agent_id === agentId))
      .toHaveLength(1);
    const filesBefore = await authed
      .get(`/api/workspace/files?agent_id=${agentId}`)
      .expect(200);
    expect(filesBefore.body.items).toHaveLength(1);

    // Delete agent → key and workspace file go with it (no FK error).
    await authed.delete(`/api/agents/${agentId}`).expect(200);

    const keysAfter = await authed.get('/api/agent-keys').expect(200);
    expect(keysAfter.body.items.filter((k: { agent_id: string }) => k.agent_id === agentId))
      .toHaveLength(0);
    const filesAfter = await authed
      .get(`/api/workspace/files?agent_id=${agentId}`)
      .expect(200);
    expect(filesAfter.body.items).toHaveLength(0);
  });
});
