// services/auth/src/models/index.js
const { Sequelize } = require('sequelize');
const UserModel = require('./User');
const LoginHistoryModel = require('./LoginHistory');

// Database configuration
const config = {
  database: process.env.POSTGRES_DB || 'flyos_db',
  username: process.env.POSTGRES_USER || 'flyos_admin',
  password: process.env.POSTGRES_PASSWORD || 'secure_password',
  host: process.env.POSTGRES_HOST || 'postgres',
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

// Create Sequelize instance
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    logging: config.logging,
    pool: config.pool
  }
);

// Initialize models
const User = UserModel(sequelize);
const LoginHistory = LoginHistoryModel(sequelize);

// Define associations
User.hasMany(LoginHistory, { foreignKey: 'userId' });
LoginHistory.belongsTo(User, { foreignKey: 'userId' });

// Export models and Sequelize instance
module.exports = {
  sequelize,
  User,
  LoginHistory
};
