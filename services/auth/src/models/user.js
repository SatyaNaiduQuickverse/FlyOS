// services/auth/src/models/User.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

/**
 * User model for authentication and authorization
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} User model
 */
module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50]
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [8, 100]
      }
    },
    role: {
      type: DataTypes.ENUM('MAIN_HQ', 'REGIONAL_HQ', 'OPERATOR'),
      allowNull: false
    },
    regionId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    tokenVersion: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    }
  }, {
    defaultScope: {
      attributes: { exclude: ['password'] }
    },
    scopes: {
      withPassword: {
        attributes: {}
      }
    },
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    }
  });

  // Instance method to validate password
  User.prototype.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password);
  };

  // Instance method to increment token version (for token revocation)
  User.prototype.incrementTokenVersion = async function() {
    this.tokenVersion += 1;
    await this.save();
    return this.tokenVersion;
  };

  // Class method to safely return user without password
  User.sanitizeUser = function(user) {
    if (!user) return null;
    
    const sanitized = { ...user.get() };
    delete sanitized.password;
    return sanitized;
  };

  return User;
};
