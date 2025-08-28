#!/usr/bin/env node

/**
 * Run Database Migrations Script
 * Executes all SQL migration files in order
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

async function runMigrations() {
  let client = null;
  
  try {
    // Database connection - use environment variables or defaults for development
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://legacylancers:password@localhost/legacylancers_db';
    
    console.log('🔌 Connecting to database...');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    client = await pool.connect();
    console.log('✅ Database connected successfully');

    // Get migration files
    const migrationsDir = path.join(__dirname, '../../db/migrations');
    const schemaFile = path.join(__dirname, '../../db/schema.sql');
    
    console.log('📋 Reading migration files...');
    
    // Read all migration files
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort to ensure proper order

    console.log(`Found ${migrationFiles.length} migration files`);

    // First, run the base schema if it exists
    try {
      const schemaSql = await fs.readFile(schemaFile, 'utf8');
      console.log('🏗️  Running base schema...');
      await client.query(schemaSql);
      console.log('✅ Base schema executed successfully');
    } catch (error) {
      console.log('ℹ️  No base schema file found or already executed');
    }

    // Run each migration
    for (const file of migrationFiles) {
      console.log(`📄 Running migration: ${file}`);
      
      try {
        const migrationSql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
        await client.query(migrationSql);
        console.log(`✅ ${file} executed successfully`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  ${file} - Tables already exist, skipping...`);
        } else {
          console.error(`❌ Error in ${file}:`, error.message);
          throw error;
        }
      }
    }

    console.log('🎉 All migrations completed successfully!');

    // Test the connection with a simple query
    const result = await client.query('SELECT COUNT(*) FROM users');
    console.log(`📊 Database ready - Users table has ${result.rows[0].count} records`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    process.exit(0);
  }
}

// Handle command line execution
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };