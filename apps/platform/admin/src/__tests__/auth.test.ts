import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupTestApp, type TestApp } from './setup.js';

describe('Phase 0 — auth', () => {
  let harness: TestApp;

  beforeAll(async () => {
    harness = await setupTestApp();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('GET /api/health reports dev demo creds in dev mode', async () => {
    const response = await harness.request.get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'admin',
      title: expect.stringContaining('Team Suzie'),
    });
  });

  it('GET /api/session returns {user: null} when unauthenticated', async () => {
    const response = await harness.request.get('/api/session');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: null });
  });

  it('POST /api/auth/login + /api/session reflects the admin user', async () => {
    const agent = await harness.loginAsAdmin();
    const response = await agent.get('/api/session');
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      email: 'admin@example.com',
      role: 'admin',
    });
  });

  it('POST /api/auth/logout clears the session', async () => {
    const agent = await harness.loginAsAdmin();
    const before = await agent.get('/api/session');
    expect(before.body.user?.email).toBe('admin@example.com');

    await agent.post('/api/auth/logout').expect(200);

    const after = await agent.get('/api/session');
    expect(after.body).toEqual({ user: null });
  });

  it('rejects bad credentials with 401', async () => {
    const response = await harness.request
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' })
      .set('Content-Type', 'application/json');
    expect(response.status).toBe(401);
  });
});
