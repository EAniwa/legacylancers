/**
 * Database Configuration
 * For development: in-memory storage simulation
 * For production: this would connect to PostgreSQL
 */

class DatabaseSimulator {
  constructor() {
    this.tables = {
      notifications: new Map(),
      user_notification_preferences: new Map(),
      notification_templates: new Map(),
      notification_queue: new Map(),
      users: new Map()
    };
  }

  /**
   * Simulate a database query
   * @param {string} query - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(query, params = []) {
    // For development purposes, we'll return empty results
    // In a real implementation, this would execute SQL queries
    
    // Simulate basic query parsing to return appropriate structure
    const lowerQuery = query.toLowerCase().trim();
    
    if (lowerQuery.startsWith('select count(*)')) {
      return { rows: [{ count: '0', total: '0' }] };
    }
    
    if (lowerQuery.startsWith('select')) {
      return { rows: [] };
    }
    
    if (lowerQuery.startsWith('insert') || lowerQuery.startsWith('update')) {
      // Return a mock result for INSERT/UPDATE
      const mockRow = {
        id: require('uuid').v4(),
        created_at: new Date(),
        updated_at: new Date()
      };
      return { rows: [mockRow] };
    }
    
    if (lowerQuery.startsWith('delete')) {
      return { rows: [] };
    }
    
    return { rows: [] };
  }

  /**
   * Begin a transaction
   * @returns {Promise<Object>} Transaction object
   */
  async begin() {
    return {
      query: this.query.bind(this),
      commit: async () => {},
      rollback: async () => {}
    };
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  async close() {
    // Nothing to close for in-memory simulation
  }
}

let db = null;

/**
 * Initialize database connection
 * @returns {Promise<Object>} Database instance
 */
async function initializeDatabase() {
  if (!db) {
    if (process.env.DATABASE_URL) {
      // In production, initialize PostgreSQL connection
      const { Pool } = require('pg');
      
      db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      
      // Test connection
      await db.query('SELECT NOW()');
      console.log('✅ Database connected successfully');
      
    } else {
      // Development: use simulator
      db = new DatabaseSimulator();
      console.log('📝 Using database simulator for development');
    }
  }
  
  return db;
}

/**
 * Get current database instance
 * @returns {Object} Database instance
 */
function getDatabase() {
  return db;
}

/**
 * Close database connection
 * @returns {Promise<void>}
 */
async function closeDatabase() {
  if (db && typeof db.close === 'function') {
    await db.close();
    db = null;
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};