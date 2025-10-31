import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import Logger from '../utils/logger';

const DB_PATH = path.join(__dirname, '../../../data/timelines.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/**
 * Initialize SQLite database with schema
 */
function initializeDatabase(): Database.Database {
  Logger.info('Initializing database', { path: DB_PATH });

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    Logger.info('Created data directory', { path: dataDir });
  }

  // Create database connection
  const db = new Database(DB_PATH);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Read and execute schema
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  Logger.info('Database initialized successfully');

  return db;
}

// Create and export database instance
export const db = initializeDatabase();

/**
 * Execute a query with logging and error handling
 */
export function query<T = any>(sql: string, params: any[] = []): T[] {
  try {
    Logger.debug('Executing query', { sql, params });
    const stmt = db.prepare(sql);
    const result = stmt.all(...params) as T[];
    return result;
  } catch (error) {
    Logger.error('Database query failed', error as Error, { sql, params });
    throw error;
  }
}

/**
 * Execute a query that returns a single row
 */
export function queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
  try {
    Logger.debug('Executing query (single row)', { sql, params });
    const stmt = db.prepare(sql);
    const result = stmt.get(...params) as T | undefined;
    return result;
  } catch (error) {
    Logger.error('Database query (single) failed', error as Error, { sql, params });
    throw error;
  }
}

/**
 * Execute an insert/update/delete with logging
 */
export function execute(sql: string, params: any[] = []): Database.RunResult {
  try {
    Logger.debug('Executing statement', { sql, params });
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return result;
  } catch (error) {
    Logger.error('Database execution failed', error as Error, { sql, params });
    throw error;
  }
}

/**
 * Execute a transaction
 */
export function transaction<T>(callback: () => T): T {
  Logger.debug('Starting transaction');
  const txn = db.transaction(callback);
  const result = txn();
  Logger.debug('Transaction completed');
  return result;
}

/**
 * Test database constraints
 */
export function testConstraints(): boolean {
  Logger.info('Testing database constraints...');

  try {
    // Test 1: Valid timeline (should succeed)
    const validTimeline = {
      id: 'test-valid',
      user_name: 'Test User',
      start_age: 14,
      end_age: 18,
      end_goal: 'Test goal',
      num_layers: 2,
    };

    execute(
      `INSERT INTO timelines (id, user_name, start_age, end_age, end_goal, num_layers)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [validTimeline.id, validTimeline.user_name, validTimeline.start_age,
       validTimeline.end_age, validTimeline.end_goal, validTimeline.num_layers]
    );
    Logger.info('✓ Valid timeline insert succeeded');

    // Test 2: Invalid timeline (end_age < start_age, should fail)
    try {
      execute(
        `INSERT INTO timelines (id, user_name, start_age, end_age, end_goal, num_layers)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['test-invalid', 'Test', 18, 14, 'Test', 2]
      );
      Logger.error('✗ Invalid timeline insert succeeded (should have failed!)');
      return false;
    } catch (e) {
      Logger.info('✓ Invalid timeline correctly rejected');
    }

    // Test 3: Valid Layer 1 block (4 years, should succeed)
    execute(
      `INSERT INTO layers (id, timeline_id, layer_number, title, start_age, end_age)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['test-layer', 'test-valid', 1, 'Test Layer', 14, 18]
    );

    execute(
      `INSERT INTO blocks (id, layer_id, layer_number, title, start_age, end_age, duration_years)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['test-block', 'test-layer', 1, 'Test Block', 14, 18, 4.0]
    );
    Logger.info('✓ Valid Layer 1 block (4 years) insert succeeded');

    // Test 4: Invalid Layer 1 block (2 years, should fail - minimum is 4)
    try {
      execute(
        `INSERT INTO blocks (id, layer_id, layer_number, title, start_age, end_age, duration_years)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['test-invalid-block', 'test-layer', 1, 'Invalid', 14, 16, 2.0]
      );
      Logger.error('✗ Invalid block (2 year Layer 1) insert succeeded (should have failed!)');
      return false;
    } catch (e) {
      Logger.info('✓ Invalid block (too short for Layer 1) correctly rejected');
    }

    // Clean up test data
    execute('DELETE FROM timelines WHERE id = ?', ['test-valid']);
    Logger.info('✓ Test cleanup completed');

    Logger.info('✓ ALL DATABASE CONSTRAINTS WORKING CORRECTLY');
    return true;

  } catch (error) {
    Logger.error('Database constraint test failed', error as Error);
    return false;
  }
}

export default db;
