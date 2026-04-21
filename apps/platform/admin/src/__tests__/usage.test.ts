import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type supertest from 'supertest';
import { AgentApiKey, Agent } from '@teamsuzie/shared-auth';
import { hashApiKey } from '@teamsuzie/shared-auth';
import { setupTestApp, type TestApp } from './setup.js';
import { UsageCollector } from '../services/usage-collector.js';
import { UsageEvent } from '../models/usage-event.js';

describe('Phase 8 — LLM usage ingest', () => {
  let harness: TestApp;
  let authed: supertest.Agent;
  let agentId: string;
  let apiKeyHash: string;

  beforeAll(async () => {
    harness = await setupTestApp();
    authed = await harness.loginAsAdmin();

    const agent = await authed
      .post('/api/agents')
      .send({ name: 'Billed', config: { baseUrl: 'http://localhost:18789' } })
      .expect(201);
    agentId = agent.body.agent.id;

    const keyResponse = await authed
      .post('/api/agent-keys')
      .send({ agent_id: agentId, name: 'usage-test', scopes: [] })
      .expect(201);
    apiKeyHash = hashApiKey(keyResponse.body.key);
    // Sanity: the admin stored the same hash for this key.
    const stored = await AgentApiKey.findOne({ where: { key_hash: apiKeyHash } });
    expect(stored?.agent_id).toBe(agentId);
  });

  afterAll(async () => {
    await harness.close();
  });

  async function ingest(overrides: Record<string, unknown> = {}): Promise<void> {
    const collector = new UsageCollector(harness.server ? 'redis://localhost:6379/0' : '');
    await collector.ingest({
      service: 'openai',
      operation: 'chat',
      model: 'gpt-4o-mini',
      input_units: 1000,
      output_units: 250,
      metadata: { user_api_key_hash: apiKeyHash, request_id: 'req-1' },
      timestamp: new Date().toISOString(),
      ...overrides,
    });
  }

  it('requires auth on usage endpoints', async () => {
    await harness.request.get('/api/activity/usage').expect(401);
    await harness.request.get('/api/activity/usage-summary').expect(401);
  });

  it('ingest attributes via user_api_key_hash and surfaces via /api/activity/usage', async () => {
    await ingest();

    const response = await authed.get('/api/activity/usage').expect(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    const row = response.body.items[0];
    expect(row).toMatchObject({
      service: 'openai',
      operation: 'chat',
      model: 'gpt-4o-mini',
      input_units: 1000,
      output_units: 250,
      agent_id: agentId,
      agent_name: 'Billed',
    });
    expect(row.cost_estimate).toBeGreaterThan(0);
  });

  it('falls back to null attribution when the key hash is unknown', async () => {
    await ingest({ metadata: { user_api_key_hash: 'deadbeef'.repeat(8) } });

    // Find the unattributed row directly — the /api/activity/usage list is
    // org-scoped so unattributed rows won't appear there.
    const orphan = await UsageEvent.findOne({
      where: { user_api_key_hash: 'deadbeef'.repeat(8) },
    });
    expect(orphan).not.toBeNull();
    expect(orphan!.agent_id).toBeNull();
    expect(orphan!.organization_id).toBeNull();
  });

  it('summarizes totals and per-service breakdown', async () => {
    // Drop a second service to verify the breakdown.
    await ingest({
      service: 'anthropic',
      model: 'claude-sonnet-4-5',
      input_units: 500,
      output_units: 100,
    });

    const response = await authed
      .get('/api/activity/usage-summary?since=1970-01-01T00:00:00Z')
      .expect(200);

    expect(response.body.total.request_count).toBeGreaterThanOrEqual(2);
    expect(response.body.total.input_units).toBeGreaterThanOrEqual(1500);
    expect(response.body.total.output_units).toBeGreaterThanOrEqual(350);
    expect(response.body.total.cost_estimate).toBeGreaterThan(0);

    const services = response.body.by_service.map((s: { service: string }) => s.service);
    expect(services).toEqual(expect.arrayContaining(['openai', 'anthropic']));
  });

  it('scopes list + summary by organization_id', async () => {
    // Direct insert attributed to a different org — should not show up for this admin.
    await UsageEvent.create({
      service: 'openai',
      operation: 'chat',
      model: 'gpt-4o-mini',
      input_units: 1,
      output_units: 1,
      cost_estimate: 0,
      organization_id: '00000000-0000-0000-0000-000000000000',
      metadata: null,
    } as Partial<UsageEvent>);

    const response = await authed.get('/api/activity/usage?limit=200').expect(200);
    for (const row of response.body.items) {
      expect(row.agent_id).not.toBeNull(); // our org's rows are all attributed in this test
    }
  });

  it('computes cost from COST_RATES when the event omits cost_estimate', async () => {
    const rowsBefore = await UsageEvent.count();
    await ingest({
      input_units: 1_000_000,
      output_units: 1_000_000,
      cost_estimate: undefined,
    });
    const rowsAfter = await UsageEvent.count();
    expect(rowsAfter).toBe(rowsBefore + 1);

    const latest = await UsageEvent.findOne({ order: [['timestamp', 'DESC']] });
    // openai:gpt-4o-mini is 0.15 + 0.60 per 1M tokens = 0.75 USD for this event.
    expect(Number(latest!.cost_estimate)).toBeCloseTo(0.75, 5);
  });

  it('resolves agent via explicit agent_id on the event if present', async () => {
    await ingest({
      agent_id: agentId,
      user_id: null,
      org_id: null,
      metadata: { user_api_key_hash: 'ignoredwhenagentidsupplied' },
    });

    const latest = await UsageEvent.findOne({
      where: { agent_id: agentId },
      order: [['timestamp', 'DESC']],
    });
    expect(latest).not.toBeNull();
    expect(latest!.agent_id).toBe(agentId);
  });

  it('recent agents + usage summary both update when the collector runs', async () => {
    // Simulate chat liveness bump (like ChatProxyService would do).
    await Agent.update({ last_active_at: new Date() }, { where: { id: agentId } });

    const agentsResponse = await authed.get('/api/activity/recent-agents').expect(200);
    expect(agentsResponse.body.items.map((a: { id: string }) => a.id)).toContain(agentId);

    const summary = await authed
      .get(`/api/activity/usage-summary?agent_id=${agentId}&since=1970-01-01T00:00:00Z`)
      .expect(200);
    expect(summary.body.total.request_count).toBeGreaterThan(0);
  });
});
