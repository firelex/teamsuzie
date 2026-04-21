import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { AuditLog } from '@teamsuzie/shared-auth';
import { setupTestApp, type TestApp } from './setup.js';

describe('Phase 3 — approvals', () => {
  let harness: TestApp;
  let authed: supertest.Agent;

  beforeAll(async () => {
    harness = await setupTestApp();
    authed = await harness.loginAsAdmin();
  });

  afterAll(async () => {
    await harness.close();
  });

  async function propose(body: Record<string, unknown> = {}): Promise<string> {
    const response = await authed
      .post('/api/approvals')
      .send({
        action_type: 'agent.action',
        payload: { tool: 'noop' },
        ...body,
      })
      .expect(201);
    return response.body.item.id;
  }

  it('requires auth on list', async () => {
    await harness.request.get('/api/approvals').expect(401);
  });

  it('exposes the seeded dispatcher action types', async () => {
    const response = await authed.get('/api/approvals/action-types').expect(200);
    expect(response.body.action_types).toContain('agent.action');
  });

  it('propose → approve auto-dispatches (registered action_type)', async () => {
    const id = await propose({ action_type: 'agent.action' });

    const reviewed = await authed
      .post(`/api/approvals/${id}/review`)
      .send({ verdict: 'approve' })
      .expect(200);

    expect(reviewed.body.item.status).toBe('dispatched');
    expect(reviewed.body.item.dispatch.result).toBe('success');

    const audits = await AuditLog.findAll({
      where: { resource_type: 'approval', resource_id: id },
      order: [['timestamp', 'ASC']],
    });
    const actions = audits.map((a) => a.action);
    expect(actions).toEqual(['approval.propose', 'approval.approve']);
  });

  it('propose → approve stays "approved" when no dispatcher is registered', async () => {
    const id = await propose({ action_type: 'workspace.delete_file', payload: { path: 'x.md' } });
    const reviewed = await authed
      .post(`/api/approvals/${id}/review`)
      .send({ verdict: 'approve', reason: 'looks fine' })
      .expect(200);
    expect(reviewed.body.item.status).toBe('approved');
    expect(reviewed.body.item.dispatch).toBeUndefined();
    expect(reviewed.body.item.review.reason).toBe('looks fine');
  });

  it('propose → reject carries the reason', async () => {
    const id = await propose();
    const reviewed = await authed
      .post(`/api/approvals/${id}/review`)
      .send({ verdict: 'reject', reason: 'not allowed' })
      .expect(200);
    expect(reviewed.body.item.status).toBe('rejected');
    expect(reviewed.body.item.review.reason).toBe('not allowed');
  });

  it('invalid verdict → 400; double-review → 409', async () => {
    const id = await propose();
    await authed.post(`/api/approvals/${id}/review`).send({ verdict: 'maybe' }).expect(400);

    await authed.post(`/api/approvals/${id}/review`).send({ verdict: 'approve' }).expect(200);
    await authed.post(`/api/approvals/${id}/review`).send({ verdict: 'reject' }).expect(409);
  });

  it('action_type is required on propose', async () => {
    await authed.post('/api/approvals').send({ payload: {} }).expect(400);
  });

  it('filters list by status', async () => {
    const pending = await propose();
    const approved = await propose();
    await authed.post(`/api/approvals/${approved}/review`).send({ verdict: 'approve' }).expect(200);

    const pendingList = await authed.get('/api/approvals?status=pending').expect(200);
    const pendingIds = pendingList.body.items.map((i: { id: string }) => i.id);
    expect(pendingIds).toContain(pending);
    expect(pendingIds).not.toContain(approved);
  });
});
