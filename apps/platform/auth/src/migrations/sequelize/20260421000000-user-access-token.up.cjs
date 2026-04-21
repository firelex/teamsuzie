const { Sequelize } = require('sequelize');

module.exports = {
    up: async ({ context: queryInterface }) => {
        await queryInterface.createTable('user_access_token', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'user',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            name: {
                type: Sequelize.STRING(100),
                allowNull: false,
                defaultValue: 'app-client'
            },
            token_hash: {
                type: Sequelize.STRING(255),
                allowNull: false,
                unique: true
            },
            token_prefix: {
                type: Sequelize.STRING(12),
                allowNull: false
            },
            last_seen_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            revoked_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            created_by: {
                type: Sequelize.UUID,
                allowNull: false
            },
            updated_by: {
                type: Sequelize.UUID,
                allowNull: false
            }
        });

        await queryInterface.addIndex('user_access_token', ['user_id'], {
            name: 'user_access_token_user_id_idx'
        });
        await queryInterface.addIndex('user_access_token', ['token_prefix'], {
            name: 'user_access_token_prefix_idx'
        });
    },
    down: async ({ context: queryInterface }) => {
        await queryInterface.dropTable('user_access_token');
    }
};
