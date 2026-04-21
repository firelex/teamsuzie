import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseModel } from '@teamsuzie/shared-auth';

/**
 * Contact extends BaseModel so it inherits id, created_at, updated_at,
 * created_by, updated_by — matching the shared-auth model conventions.
 */
@Table({
  tableName: 'starter_ops_contacts',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class Contact extends BaseModel {
  @Column({ type: DataType.UUID, allowNull: false })
  declare organization_id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare company: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;
}
