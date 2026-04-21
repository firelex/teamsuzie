import {
  ConfigDefinition,
  ConfigValue,
  User,
  decrypt,
  encrypt,
  type ConfigCategory,
  type ConfigScope,
  type ConfigValueType,
  type Scope,
  type ValidationSchema,
} from '@teamsuzie/shared-auth';

export interface ConfigDefinitionSummary {
  id: string;
  key: string;
  display_name: string;
  description: string | null;
  category: ConfigCategory;
  value_type: ConfigValueType;
  default_value: string | null;
  allowed_scopes: ConfigScope[];
  is_sensitive: boolean;
  requires_restart: boolean;
  validation_schema: ValidationSchema | null;
}

export interface ResolvedConfig {
  key: string;
  /** null when the value is a redacted secret OR when nothing is set at any scope. */
  value: string | null;
  /** The scope that provided the value. 'default' means no value set — default_value shown. */
  source_scope: Scope | 'default';
  source_scope_id: string | null;
  definition: ConfigDefinitionSummary;
}

export interface ScopeRef {
  scope: Scope;
  scope_id: string | null;
}

export interface DefinitionSeed {
  key: string;
  display_name: string;
  description?: string;
  category: ConfigCategory;
  value_type: ConfigValueType;
  default_value?: string | null;
  allowed_scopes?: ConfigScope[];
  is_sensitive?: boolean;
  requires_restart?: boolean;
  validation_schema?: ValidationSchema | null;
}

export class ServiceInputError extends Error {
  readonly code: string;
  constructor(message: string, code = 'INVALID_INPUT') {
    super(message);
    this.code = code;
    this.name = 'ServiceInputError';
  }
}

function summarize(def: ConfigDefinition): ConfigDefinitionSummary {
  return {
    id: def.id,
    key: def.key,
    display_name: def.display_name,
    description: def.description,
    category: def.category,
    value_type: def.value_type,
    default_value: def.default_value,
    allowed_scopes: def.allowed_scopes,
    is_sensitive: def.is_sensitive,
    requires_restart: def.requires_restart,
    validation_schema: def.validation_schema,
  };
}

/** Hierarchy to walk when resolving. Most-specific wins. */
function orderedScopes(scopes: ScopeRef[]): ScopeRef[] {
  const rank: Record<Scope, number> = { agent: 0, user: 1, org: 2, global: 3 };
  return [...scopes].sort((a, b) => rank[a.scope] - rank[b.scope]);
}

export class ConfigService {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  async resolveOrgId(userId: string): Promise<string | null> {
    const user = await User.findByPk(userId);
    return user?.default_organization_id ?? null;
  }

  async ensureDefinitions(seeds: DefinitionSeed[]): Promise<{ created: number }> {
    let created = 0;
    for (const seed of seeds) {
      const existing = await ConfigDefinition.findOne({ where: { key: seed.key } });
      if (existing) continue;
      await ConfigDefinition.create({
        key: seed.key,
        display_name: seed.display_name,
        description: seed.description ?? null,
        category: seed.category,
        value_type: seed.value_type,
        default_value: seed.default_value ?? null,
        allowed_scopes: seed.allowed_scopes ?? ['global'],
        is_sensitive: seed.is_sensitive ?? false,
        requires_restart: seed.requires_restart ?? false,
        validation_schema: seed.validation_schema ?? null,
      } as Partial<ConfigDefinition>);
      created += 1;
    }
    return { created };
  }

  async listDefinitions(category?: ConfigCategory): Promise<ConfigDefinitionSummary[]> {
    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    const defs = await ConfigDefinition.findAll({ where, order: [['key', 'ASC']] });
    return defs.map(summarize);
  }

  /**
   * Resolve a single key against a scope hierarchy. Returns the most-specific
   * matching value, or the definition's default_value, or null. Secrets are
   * redacted to null (the definition's is_sensitive flag tells the caller).
   */
  async resolve(
    key: string,
    scopes: ScopeRef[],
    opts: { redactSensitive?: boolean } = {},
  ): Promise<ResolvedConfig | null> {
    const def = await ConfigDefinition.findOne({ where: { key } });
    if (!def) return null;

    for (const ref of orderedScopes(scopes)) {
      const row = await ConfigValue.findOne({
        where: {
          definition_id: def.id,
          scope: ref.scope,
          scope_id: ref.scope_id,
        },
      });
      if (!row) continue;
      const plaintext = this.decryptValue(row.value_encrypted);
      const value = def.is_sensitive && opts.redactSensitive !== false ? null : plaintext;
      return {
        key: def.key,
        value,
        source_scope: ref.scope,
        source_scope_id: ref.scope_id,
        definition: summarize(def),
      };
    }

    return {
      key: def.key,
      value:
        def.is_sensitive && opts.redactSensitive !== false ? null : (def.default_value ?? null),
      source_scope: 'default',
      source_scope_id: null,
      definition: summarize(def),
    };
  }

  /**
   * Runtime helper for in-process consumers (e.g. ChatProxyService). Returns
   * the plaintext value even for sensitive definitions — caller is trusted
   * because it's not an HTTP boundary.
   */
  async resolveValue(key: string, scopes: ScopeRef[]): Promise<string | null> {
    const resolved = await this.resolve(key, scopes, { redactSensitive: false });
    if (!resolved) return null;
    return resolved.value;
  }

  /** Resolve every definition at a scope. Used by UI and config-client `getAll`. */
  async resolveAll(
    scopes: ScopeRef[],
    opts: { category?: ConfigCategory; redactSensitive?: boolean } = {},
  ): Promise<ResolvedConfig[]> {
    const defs = await this.listDefinitions(opts.category);
    const out: ResolvedConfig[] = [];
    for (const def of defs) {
      const resolved = await this.resolve(def.key, scopes, { redactSensitive: opts.redactSensitive });
      if (resolved) out.push(resolved);
    }
    return out;
  }

  async setValue(input: {
    key: string;
    scope: Scope;
    scope_id: string | null;
    value: string;
    actorId: string;
  }): Promise<ResolvedConfig> {
    const def = await ConfigDefinition.findOne({ where: { key: input.key } });
    if (!def) throw new ServiceInputError('Unknown config key', 'NOT_FOUND');

    if (!def.allowed_scopes.includes(input.scope as ConfigScope)) {
      // Note: Scope ('user') is superset of ConfigScope ('global'|'org'|'agent').
      // The definition's allowed_scopes uses ConfigScope. If caller asks for
      // 'user' and it's not listed, reject.
      throw new ServiceInputError(
        `Scope "${input.scope}" is not allowed for "${input.key}". Allowed: ${def.allowed_scopes.join(', ')}`,
      );
    }

    this.coerceValue(def, input.value);

    const existing = await ConfigValue.findOne({
      where: {
        definition_id: def.id,
        scope: input.scope,
        scope_id: input.scope_id,
      },
    });

    const encrypted = encrypt(input.value, this.secret);

    if (existing) {
      existing.value_encrypted = encrypted;
      existing.updated_by = input.actorId;
      await existing.save();
    } else {
      await ConfigValue.create({
        definition_id: def.id,
        scope: input.scope,
        scope_id: input.scope_id,
        value_encrypted: encrypted,
        created_by: input.actorId,
        updated_by: input.actorId,
      } as Partial<ConfigValue>);
    }

    const resolved = await this.resolve(def.key, [{ scope: input.scope, scope_id: input.scope_id }]);
    return resolved!;
  }

  async unsetValue(input: {
    key: string;
    scope: Scope;
    scope_id: string | null;
  }): Promise<boolean> {
    const def = await ConfigDefinition.findOne({ where: { key: input.key } });
    if (!def) return false;
    const deleted = await ConfigValue.destroy({
      where: {
        definition_id: def.id,
        scope: input.scope,
        scope_id: input.scope_id,
      },
    });
    return deleted > 0;
  }

  private decryptValue(value: string): string {
    try {
      return decrypt(value, this.secret);
    } catch (err) {
      console.error(
        `[admin.config] decrypt failed; CONFIG_SECRET may have changed since this value was written. err=${err instanceof Error ? err.message : String(err)}`,
      );
      return '';
    }
  }

  private coerceValue(def: ConfigDefinition, value: string): void {
    switch (def.value_type) {
      case 'number':
        if (!/^-?\d+(\.\d+)?$/.test(value)) {
          throw new ServiceInputError(`${def.key} must be a number`);
        }
        break;
      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          throw new ServiceInputError(`${def.key} must be "true" or "false"`);
        }
        break;
      case 'json':
        try {
          JSON.parse(value);
        } catch {
          throw new ServiceInputError(`${def.key} must be valid JSON`);
        }
        break;
      // string and secret: no shape check beyond what's below
    }

    const schema = def.validation_schema;
    if (schema) {
      if (schema.enum && !schema.enum.includes(value)) {
        throw new ServiceInputError(`${def.key} must be one of: ${schema.enum.join(', ')}`);
      }
      if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
        throw new ServiceInputError(`${def.key} must be at least ${schema.minLength} characters`);
      }
      if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
        throw new ServiceInputError(`${def.key} must be at most ${schema.maxLength} characters`);
      }
    }
  }
}

/**
 * OSS-safe seed definitions. Deliberately small — add real definitions via
 * migrations as services grow. Only the runtime-editable knobs that
 * meaningfully change app behavior belong here.
 */
export const DEFAULT_DEFINITIONS: DefinitionSeed[] = [
  {
    key: 'admin.title',
    display_name: 'Admin title',
    description: 'Shown in the sidebar wordmark and the login card. Overrides ADMIN_TITLE env.',
    category: 'platform',
    value_type: 'string',
    allowed_scopes: ['global'],
  },
  {
    key: 'chat.default_model',
    display_name: 'Default chat model',
    description:
      'Model name passed to the OpenClaw runtime for chat completions. Per-agent config.text_model overrides this.',
    category: 'ai',
    value_type: 'string',
    default_value: 'default',
    allowed_scopes: ['global', 'agent'],
  },
  {
    key: 'approvals.require_by_default',
    display_name: 'Require approvals by default',
    description:
      'When true, new agents are created with approval_required=true unless explicitly overridden.',
    category: 'platform',
    value_type: 'boolean',
    default_value: 'false',
    allowed_scopes: ['global'],
  },
  {
    key: 'integrations.webhook_secret',
    display_name: 'Webhook signing secret',
    description:
      'Shared secret for validating inbound webhook signatures. Secrets are never returned in plaintext — use "Replace" to rotate.',
    category: 'service',
    value_type: 'secret',
    allowed_scopes: ['global'],
    is_sensitive: true,
    requires_restart: true,
  },
];
