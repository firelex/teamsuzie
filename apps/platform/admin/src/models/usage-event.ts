import { Table, Column, DataType, PrimaryKey, Default, Model } from 'sequelize-typescript';

/**
 * Admin-owned cache of LLM usage events published by the llm-proxy over the
 * Redis `usage:events` channel. Attribution (agent_id / user_id / organization_id)
 * is resolved lazily via `user_api_key_hash` when the event is ingested —
 * rows can exist with nulls when we can't match the hash to any known key.
 */
@Table({
  tableName: 'usage_event',
  underscored: true,
  timestamps: false,
})
export class UsageEvent extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare timestamp: Date;

  @Column({ type: DataType.STRING(50), allowNull: false })
  declare service: string;

  @Column({ type: DataType.STRING(50), allowNull: false })
  declare operation: string;

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare model: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare input_units: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare output_units: number;

  @Column({
    type: DataType.DECIMAL(12, 6),
    allowNull: false,
    defaultValue: 0,
    get(this: UsageEvent): number {
      const raw = this.getDataValue('cost_estimate') as unknown;
      return typeof raw === 'string' ? parseFloat(raw) : (raw as number);
    },
  })
  declare cost_estimate: number;

  /** SHA-256 of the bearer token that made the LLM call. Matches AgentApiKey.key_hash. */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare user_api_key_hash: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare request_id: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare agent_id: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare user_id: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare organization_id: string | null;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare metadata: Record<string, unknown> | null;
}
