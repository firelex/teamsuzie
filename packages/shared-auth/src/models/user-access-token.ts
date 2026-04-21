import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseModel } from './base-model.js';
import { User } from './user.js';

@Table({
    tableName: 'user_access_token',
    underscored: true
})
export class UserAccessToken extends BaseModel {

    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: false
    })
    declare user_id: string;

    @Column({
        type: DataType.STRING(100),
        allowNull: false,
        defaultValue: 'app-client'
    })
    declare name: string;

    @Column({
        type: DataType.STRING(255),
        allowNull: false,
        unique: true
    })
    declare token_hash: string;

    @Column({
        type: DataType.STRING(12),
        allowNull: false
    })
    declare token_prefix: string;

    @Column({
        type: DataType.DATE,
        allowNull: true
    })
    declare last_seen_at: Date | null;

    @Column({
        type: DataType.DATE,
        allowNull: true
    })
    declare expires_at: Date | null;

    @Column({
        type: DataType.DATE,
        allowNull: true
    })
    declare revoked_at: Date | null;

    @BelongsTo(() => User)
    declare user?: User;
}
