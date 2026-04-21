import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { AuditLog } from '@teamsuzie/shared-auth';
import { setupTestApp, type TestApp } from './setup.js';

describe('Phase 6 — config', () => {
  let harness: TestApp;
  let authed: supertest.Agent;

  beforeAll(async () => {
    harness = await setupTestApp();
    authed = await harness.loginAsAdmin();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('seeds the four default definitions on boot', async () => {
    const response = await authed.get('/api/config/definitions').expect(200);
    const keys = response.body.items.map((d: { key: string }) => d.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'admin.title',
        'chat.default_model',
        'approvals.require_by_default',
        'integrations.webhook_secret',
      ]),
    );
  });

  it('values list shows definition defaults when nothing is set', async () => {
    const response = await authed.get('/api/config/values?scope=global').expect(200);
    const byKey = new Map<string, { value: string | null; source_scope: string }>(
      response.body.values.map((v: { key: string; value: string | null; source_scope: string }) => [
        v.key,
        { value: v.value, source_scope: v.source_scope },
      ]),
    );
    expect(byKey.get('chat.default_model')).toEqual({ value: 'default', source_scope: 'default' });
    // Sensitive with no default → redacted null.
    expect(byKey.get('integrations.webhook_secret')).toEqual({ value: null, source_scope: 'default' });
  });

  it('PUT a non-sensitive value persists plaintext and flips source to "global"', async () => {
    await authed
      .put('/api/config/values/chat.default_model')
      .send({ scope: 'global', value: 'gpt-4.1-mini' })
      .expect(200);

    const got = await authed
      .get('/api/config/values/chat.default_model?scope=global')
      .expect(200);
    expect(got.body.config).toMatchObject({ value: 'gpt-4.1-mini', source_scope: 'global' });
  });

  it('PUT a sensitive value stores but never echoes plaintext', async () => {
    const set = await authed
      .put('/api/config/values/integrations.webhook_secret')
      .send({ scope: 'global', value: 'shh-super-secret-123' })
      .expect(200);
    // Response still redacts.
    expect(set.body.config.value).toBeNull();

    const got = await authed
      .get('/api/config/values/integrations.webhook_secret?scope=global')
      .expect(200);
    expect(got.body.config.value).toBeNull();
    expect(got.body.config.source_scope).toBe('global');
  });

  it('boolean coercion rejects non-boolean values with 400', async () => {
    await authed
      .put('/api/config/values/approvals.require_by_default')
      .send({ scope: 'global', value: 'maybe' })
      .expect(400);

    // Valid bool still works.
    await authed
      .put('/api/config/values/approvals.require_by_default')
      .send({ scope: 'global', value: 'true' })
      .expect(200);
  });

  it('unknown key → 404', async () => {
    await authed
      .put('/api/config/values/does.not.exist')
      .send({ scope: 'global', value: 'x' })
      .expect(404);
  });

  it('agent-scope value wins over global in hierarchy resolution', async () => {
    const agent = await authed
      .post('/api/agents')
      .send({ name: 'PhiTester', config: { baseUrl: 'http://localhost:18789' } })
      .expect(201);
    const agentId = agent.body.agent.id;

    await authed
      .put('/api/config/values/chat.default_model')
      .send({ scope: 'agent', scope_id: agentId, value: 'phi-3-mini' })
      .expect(200);

    const resolved = await authed
      .get(`/api/config/values/chat.default_model?scope=agent&scope_id=${agentId}`)
      .expect(200);
    expect(resolved.body.config).toMatchObject({
      value: 'phi-3-mini',
      source_scope: 'agent',
      source_scope_id: agentId,
    });

    // Global still gpt-4.1-mini (set earlier in this file).
    const global = await authed
      .get('/api/config/values/chat.default_model?scope=global')
      .expect(200);
    expect(global.body.config.value).toBe('gpt-4.1-mini');
  });

  it('DELETE unsets at that scope; missing → 404', async () => {
    await authed
      .delete('/api/config/values/chat.default_model?scope=global')
      .expect(200);

    const after = await authed
      .get('/api/config/values/chat.default_model?scope=global')
      .expect(200);
    expect(after.body.config).toMatchObject({ value: 'default', source_scope: 'default' });

    await authed
      .delete('/api/config/values/chat.default_model?scope=global')
      .expect(404);
  });

  it('writes AuditLog rows on update and delete', async () => {
    // Set + unset a bool to generate fresh rows.
    await authed
      .put('/api/config/values/approvals.require_by_default')
      .send({ scope: 'global', value: 'false' })
      .expect(200);
    await authed
      .delete('/api/config/values/approvals.require_by_default?scope=global')
      .expect(200);

    const rows = await AuditLog.findAll({
      where: { resource_type: 'config_value' },
      order: [['timestamp', 'DESC']],
      limit: 10,
    });
    const actions = rows.map((r) => r.action);
    expect(actions).toContain('config.update');
    expect(actions).toContain('config.delete');
  });

  it('rejects unauth requests with 401', async () => {
    await harness.request.get('/api/config/definitions').expect(401);
  });
});
