import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { setupTestApp, type TestApp } from './setup.js';

describe('Phase 5 — tokens (agent keys + user access tokens)', () => {
  let harness: TestApp;
  let authed: supertest.Agent;
  let agentId: string;

  beforeAll(async () => {
    harness = await setupTestApp();
    authed = await harness.loginAsAdmin();
    const response = await authed
      .post('/api/agents')
      .send({ name: 'Courier', config: { baseUrl: 'http://localhost:18789' } })
      .expect(201);
    agentId = response.body.agent.id;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('lists the OSS-safe scope catalog', async () => {
    const response = await authed.get('/api/agent-keys/scopes').expect(200);
    const slugs = response.body.scopes.map((s: { scope: string }) => s.scope);
    expect(slugs).toEqual(
      expect.arrayContaining(['documents:read', 'documents:write', 'config:read']),
    );
  });

  it('create → use bearer on /api/approvals → revoke → 401', async () => {
    const create = await authed
      .post('/api/agent-keys')
      .send({ agent_id: agentId, name: 'smoke', scopes: ['documents:read'] })
      .expect(201);
    const token = create.body.key as string;
    expect(token.startsWith('dtk_')).toBe(true);

    // Agent bearer can propose without a session cookie. Use a stateless
    // supertest request (no cookie jar) to make sure we're really testing
    // bearer-only auth.
    const stateless = supertest(harness.app);
    const proposed = await stateless
      .post('/api/approvals')
      .set('Authorization', `Bearer ${token}`)
      .send({ action_type: 'agent.action', payload: { ping: true } })
      .expect(201);
    expect(proposed.body.item.metadata.proposed_by_agent_id).toBe(agentId);
    expect(proposed.body.item.subject_id).toBe(agentId);

    // last_used_at updated on the key.
    const list = await authed.get('/api/agent-keys').expect(200);
    const row = list.body.items.find((k: { id: string }) => k.id === create.body.summary.id);
    expect(row.last_used_at).not.toBeNull();

    // Revoke → subsequent use 401.
    await authed.delete(`/api/agent-keys/${create.body.summary.id}`).expect(200);
    await stateless
      .post('/api/approvals')
      .set('Authorization', `Bearer ${token}`)
      .send({ action_type: 'agent.action', payload: {} })
      .expect(401);
  });

  it('rejects a missing agent_id on create with 400', async () => {
    await authed.post('/api/agent-keys').send({ name: 'oops' }).expect(400);
  });

  it('user access token (tsu_) authenticates session-auth routes via Bearer', async () => {
    const create = await authed
      .post('/api/auth/tokens')
      .send({ token_name: 'laptop-cli', expires_in_days: 7 })
      .expect(201);
    const token = create.body.access_token as string;
    expect(token.startsWith('tsu_')).toBe(true);

    // Bearer works on a session-guarded admin route. Use a stateless
    // request so we're not inadvertently carrying cookies from earlier tests.
    const stateless = supertest(harness.app);
    const response = await stateless
      .get('/api/agents')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(response.body.items)).toBe(true);

    // Revoke → 401 on next use.
    const list = await authed.get('/api/auth/tokens').expect(200);
    const laptop = list.body.tokens.find((t: { name: string }) => t.name === 'laptop-cli');
    await authed.delete(`/api/auth/tokens/${laptop.id}`).expect(200);

    await stateless
      .get('/api/agents')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('unauth POST /api/approvals returns 401', async () => {
    await supertest(harness.app)
      .post('/api/approvals')
      .send({ action_type: 'agent.action', payload: {} })
      .expect(401);
  });
});
