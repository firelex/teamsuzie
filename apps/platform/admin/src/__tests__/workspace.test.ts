import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { setupTestApp, type TestApp } from './setup.js';

describe('Phase 4 — workspace artifacts', () => {
  let harness: TestApp;
  let authed: supertest.Agent;
  let agentId: string;

  beforeAll(async () => {
    harness = await setupTestApp();
    authed = await harness.loginAsAdmin();
    const response = await authed
      .post('/api/agents')
      .send({ name: 'Scribe', config: { baseUrl: 'http://localhost:18789' } })
      .expect(201);
    agentId = response.body.agent.id;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('requires auth', async () => {
    await harness.request.get('/api/workspace/files').expect(401);
  });

  it('creates an artifact with 201, upserts with 200', async () => {
    const create = await authed
      .post('/api/workspace/files')
      .send({
        agent_id: agentId,
        file_path: 'notes/today.md',
        content: '# hello',
        content_type: 'markdown',
      })
      .expect(201);
    expect(create.body.created).toBe(true);
    expect(create.body.file.size_bytes).toBe(Buffer.byteLength('# hello'));

    const upsert = await authed
      .post('/api/workspace/files')
      .send({
        agent_id: agentId,
        file_path: 'notes/today.md',
        content: '# hello, longer',
        content_type: 'markdown',
      })
      .expect(200);
    expect(upsert.body.created).toBe(false);
    expect(upsert.body.file.id).toBe(create.body.file.id);
    expect(upsert.body.file.size_bytes).toBe(Buffer.byteLength('# hello, longer'));
  });

  it('filters list by agent_id (uuid, null, any)', async () => {
    await authed
      .post('/api/workspace/files')
      .send({
        agent_id: null,
        file_path: 'config/preferences.json',
        content: '{"theme":"dark"}',
        content_type: 'json',
      })
      .expect(201);

    const all = await authed.get('/api/workspace/files').expect(200);
    expect(all.body.items.length).toBeGreaterThanOrEqual(2);

    const agentScoped = await authed
      .get(`/api/workspace/files?agent_id=${agentId}`)
      .expect(200);
    expect(agentScoped.body.items.every((f: { agent_id: string | null }) => f.agent_id === agentId))
      .toBe(true);

    const unattached = await authed.get('/api/workspace/files?agent_id=null').expect(200);
    expect(unattached.body.items.every((f: { agent_id: string | null }) => f.agent_id === null))
      .toBe(true);
    expect(unattached.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects path traversal (400)', async () => {
    await authed
      .post('/api/workspace/files')
      .send({
        file_path: '../etc/passwd',
        content: 'oops',
        content_type: 'text',
      })
      .expect(400);
  });

  it('rejects invalid content_type (400)', async () => {
    await authed
      .post('/api/workspace/files')
      .send({ file_path: 'a.bin', content: 'x', content_type: 'binary' })
      .expect(400);
  });

  it('rejects unknown agent_id (404)', async () => {
    await authed
      .post('/api/workspace/files')
      .send({
        agent_id: '00000000-0000-0000-0000-000000000000',
        file_path: 'a.md',
        content: 'x',
        content_type: 'markdown',
      })
      .expect(404);
  });

  it('GET /:id returns the content; DELETE returns 200 then 404', async () => {
    const create = await authed
      .post('/api/workspace/files')
      .send({
        agent_id: agentId,
        file_path: 'ephemeral.md',
        content: '## bye',
        content_type: 'markdown',
      })
      .expect(201);
    const id = create.body.file.id;

    const got = await authed.get(`/api/workspace/files/${id}`).expect(200);
    expect(got.body.file.content).toBe('## bye');

    await authed.delete(`/api/workspace/files/${id}`).expect(200);
    await authed.delete(`/api/workspace/files/${id}`).expect(404);
  });
});
