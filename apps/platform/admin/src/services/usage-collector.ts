import { Redis } from 'ioredis';
import { AgentApiKey, Agent } from '@teamsuzie/shared-auth';
import { calculateCost, type UsageService, type UsageOperation } from '@teamsuzie/usage-tracker';
import { UsageEvent } from '../models/usage-event.js';

/**
 * Subscribes to the Redis `usage:events` channel the llm-proxy publishes to
 * and persists each event to admin's `usage_event` table. Attribution
 * (agent_id / user_id / organization_id) is resolved from `user_api_key_hash`
 * at ingest time — the proxy itself never hits the DB on the hot path.
 *
 * If the hash doesn't match any known `AgentApiKey`, the row is still
 * inserted with null attribution so the raw event isn't lost.
 */

interface RawUsageEvent {
  service: string;
  operation: string;
  model?: string;
  input_units?: number;
  output_units?: number;
  cost_estimate?: number;
  timestamp?: string;
  metadata?: {
    request_id?: string;
    user_api_key_hash?: string;
    cached_tokens?: number;
    cache_creation_tokens?: number;
    [key: string]: unknown;
  };
  // Some publishers (the @teamsuzie/usage-tracker client) attach attribution
  // directly rather than via api-key-hash lookup.
  org_id?: string;
  user_id?: string;
  agent_id?: string;
}

const DEFAULT_CHANNEL = 'usage:events';

export class UsageCollector {
  private subscriber: Redis | null = null;
  private started = false;

  constructor(
    private readonly redisUrl: string,
    private readonly channel: string = DEFAULT_CHANNEL,
  ) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.subscriber = new Redis(this.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: false,
    });

    this.subscriber.on('error', (err) => {
      console.error(`[admin.usage-collector] redis error: ${err.message}`);
    });

    await this.subscriber.subscribe(this.channel);
    this.subscriber.on('message', async (chan, message) => {
      if (chan !== this.channel) return;
      try {
        const raw = JSON.parse(message) as RawUsageEvent;
        await this.ingest(raw);
      } catch (err) {
        console.error(
          `[admin.usage-collector] ingest failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    this.started = true;
    console.log(`[admin.usage-collector] subscribed to ${this.channel}`);
  }

  async ingest(raw: RawUsageEvent): Promise<UsageEvent> {
    const keyHash = raw.metadata?.user_api_key_hash ?? null;
    let agent_id: string | null = raw.agent_id ?? null;
    let user_id: string | null = raw.user_id ?? null;
    let organization_id: string | null = raw.org_id ?? null;

    // Prefer explicit attribution on the event; fall back to key-hash lookup.
    if (!agent_id && keyHash) {
      try {
        const match = await AgentApiKey.findOne({
          where: { key_hash: keyHash },
          attributes: ['agent_id'],
        });
        if (match) {
          agent_id = match.agent_id;
          const agent = await Agent.findByPk(match.agent_id, {
            attributes: ['user_id', 'organization_id'],
          });
          if (agent) {
            user_id = user_id ?? agent.user_id;
            organization_id = organization_id ?? agent.organization_id;
          }
        }
      } catch (err) {
        // Attribution best-effort — store the row anyway.
        console.warn(
          `[admin.usage-collector] attribution lookup failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const input_units = raw.input_units ?? 0;
    const output_units = raw.output_units ?? 0;

    // Compute cost_estimate only if the publisher didn't supply one and the
    // event maps to a known (service, model/operation) rate.
    let cost = raw.cost_estimate;
    if (cost === undefined || cost === null) {
      try {
        cost = calculateCost({
          org_id: organization_id ?? '',
          user_id: user_id ?? '',
          service: raw.service as UsageService,
          operation: raw.operation as UsageOperation,
          model: raw.model,
          input_units,
          output_units,
          metadata: raw.metadata,
        });
      } catch {
        cost = 0;
      }
    }

    const timestamp = raw.timestamp ? new Date(raw.timestamp) : new Date();

    return UsageEvent.create({
      timestamp,
      service: raw.service,
      operation: raw.operation,
      model: raw.model ?? null,
      input_units,
      output_units,
      cost_estimate: cost ?? 0,
      user_api_key_hash: keyHash,
      request_id: raw.metadata?.request_id ?? null,
      agent_id,
      user_id,
      organization_id,
      metadata: raw.metadata ? { ...raw.metadata } : null,
    } as Partial<UsageEvent>);
  }

  async stop(): Promise<void> {
    if (!this.subscriber) return;
    try {
      await this.subscriber.unsubscribe(this.channel);
    } catch {
      // Ignore — connection may already be gone.
    }
    try {
      await this.subscriber.quit();
    } catch {
      // Ignore.
    }
    this.subscriber = null;
    this.started = false;
  }
}
