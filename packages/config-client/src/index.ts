import type { ScopeRef } from '@teamsuzie/types';

export interface ConfigClientOptions {
  baseUrl: string;
  apiKey?: string;
  cacheTtl?: number;
  timeout?: number;
}

export interface ConfigDefinition {
  id: string;
  key: string;
  display_name: string;
  description: string | null;
  category: string;
  value_type: string;
  default_value: string | null;
  allowed_scopes: string[];
  is_sensitive: boolean;
  requires_restart: boolean;
}

export interface ResolvedConfig {
  key: string;
  value: string | null;
  source_scope: string;
  source_scope_id: string | null;
  definition: ConfigDefinition;
}

interface CacheEntry {
  value: string | null;
  expires: number;
}

export class ConfigClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly cacheTtl: number;
  private readonly timeout: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: ConfigClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.cacheTtl = options.cacheTtl ?? 60_000;
    this.timeout = options.timeout ?? 5_000;
  }

  private getCacheKey(key: string, scopes: ScopeRef[]): string {
    const scopeStr = scopes
      .map((scopeRef) => `${scopeRef.scope}:${scopeRef.scope_id ?? 'null'}`)
      .join('|');

    return `${key}:${scopeStr}`;
  }

  private getFromCache(cacheKey: string): string | null | undefined {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return entry.value;
  }

  private setCache(cacheKey: string, value: string | null): void {
    this.cache.set(cacheKey, {
      value,
      expires: Date.now() + this.cacheTtl,
    });
  }

  async get(key: string, scopes: ScopeRef[], fallback?: string): Promise<string | null> {
    const cacheKey = this.getCacheKey(key, scopes);
    const cached = this.getFromCache(cacheKey);
    if (cached !== undefined) {
      return cached ?? fallback ?? null;
    }

    try {
      const scopeParams = scopes
        .filter((scopeRef) => scopeRef.scope !== 'global')
        .map((scopeRef) => `scope=${scopeRef.scope}&scope_id=${scopeRef.scope_id}`)
        .join('&');

      const url =
        scopeParams.length > 0
          ? `${this.baseUrl}/api/config/values/${encodeURIComponent(key)}?${scopeParams}`
          : `${this.baseUrl}/api/config/values/${encodeURIComponent(key)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['X-Agent-API-Key'] = this.apiKey;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          this.setCache(cacheKey, null);
          return fallback ?? null;
        }

        throw new Error(`Config fetch failed: ${response.status}`);
      }

      const data = (await response.json()) as { config?: { value?: string | null } };
      const value = data.config?.value ?? null;

      this.setCache(cacheKey, value);
      return value ?? fallback ?? null;
    } catch (error) {
      console.error(`[CONFIG_CLIENT] Error fetching ${key}:`, error);
      return fallback ?? null;
    }
  }

  async getAll(scopes: ScopeRef[], category?: string): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();

    try {
      const primaryScope = scopes[0];
      if (!primaryScope) {
        return result;
      }

      let url = `${this.baseUrl}/api/config/values?scope=${primaryScope.scope}`;
      if (primaryScope.scope_id) {
        url += `&scope_id=${primaryScope.scope_id}`;
      }
      if (category) {
        url += `&category=${encodeURIComponent(category)}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['X-Agent-API-Key'] = this.apiKey;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Config fetch failed: ${response.status}`);
      }

      const data = (await response.json()) as { values?: ResolvedConfig[] };
      const values = data.values ?? [];

      for (const config of values) {
        result.set(config.key, config.value);
        const cacheKey = this.getCacheKey(config.key, scopes);
        this.setCache(cacheKey, config.value);
      }
    } catch (error) {
      console.error('[CONFIG_CLIENT] Error fetching all configs:', error);
    }

    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearCacheFor(key: string): void {
    for (const cacheKey of this.cache.keys()) {
      if (cacheKey.startsWith(`${key}:`)) {
        this.cache.delete(cacheKey);
      }
    }
  }

  buildScopeHierarchy(agentId?: string, orgId?: string, includeGlobal = true): ScopeRef[] {
    const scopes: ScopeRef[] = [];

    if (agentId) {
      scopes.push({ scope: 'agent', scope_id: agentId });
    }
    if (orgId) {
      scopes.push({ scope: 'org', scope_id: orgId });
    }
    if (includeGlobal) {
      scopes.push({ scope: 'global', scope_id: null });
    }

    return scopes;
  }
}

export function createConfigClient(options: ConfigClientOptions): ConfigClient {
  return new ConfigClient(options);
}
