// services/auth/src/models/loginHistory.js
const { DataTypes } = require('sequelize');

/**
 * User Login History model for tracking authentication events
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} LoginHistory model
 */
module.exports = (sequelize) => {
  const LoginHistory = sequelize.define('LoginHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true
    },
    loginTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    logoutTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('SUCCESS', 'FAILED', 'EXPIRED'),
      allowNull: false,
      defaultValue: 'SUCCESS'
    },
    failureReason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    sessionDuration: {
      type: DataTypes.VIRTUAL,
      get() {
        if (!this.logoutTime || !this.loginTime) return null;
        // Return duration in seconds
        return Math.floor((this.logoutTime - this.loginTime) / 1000);
      }
    }
  });

  // Class method to record login
  LoginHistory.recordLogin = async function(user, req, status = 'SUCCESS', failureReason = null) {
    try {
      return await this.create({
        userId: user?.id || null,
        username: user?.username || req.body?.username || 'unknown',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.headers['user-agent'] || null,
        status,
        failureReason
      });
    } catch (error) {
      console.error('Failed to record login history:', error);
      // Don't throw - just log the error and continue
      return null;
    }
  };

  // Class method to record logout with improved handling
  LoginHistory.recordLogout = async function(sessionId) {
    try {
      if (!sessionId) {
        console.warn('No session ID provided for logout');
        return null;
      }

      const session = await this.findByPk(sessionId);
      if (session) {
        if (session.logoutTime) {
          console.log(`Session ${sessionId} already logged out at ${session.logoutTime}`);
          return session;
        }

        // Set logout time to current time
        session.logoutTime = new Date();
        
        // Calculate session duration in seconds for logging
        const loginTime = new Date(session.loginTime);
        const logoutTime = new Date(session.logoutTime);
        const durationInSeconds = Math.floor((logoutTime.getTime() - loginTime.getTime()) / 1000);
        
        // Log the logout with duration info
        console.log(`Recording logout for session ${sessionId}, duration: ${durationInSeconds}s`);
        
        // Save the updated session
        await session.save();
        return session;
      } else {
        console.warn(`Session ${sessionId} not found for logout`);
        return null;
      }
    } catch (error) {
      console.error('Failed to record logout:', error);
      return null;
    }
  };

  return LoginHistory;
};
