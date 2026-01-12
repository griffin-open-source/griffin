import { Pool } from 'pg';

let pool: Pool | null = null;

export async function setupDatabase() {
  const connectionString = process.env.POSTGRESQL_URL;
  
  if (!connectionString) {
    throw new Error('POSTGRESQL_URL environment variable is required');
  }

  pool = new Pool({
    connectionString,
  });

  // Test connection
  await pool.query('SELECT NOW()');
  console.log('Database connection established');

  // TODO: Create tables if they don't exist
  // - test_plans
  // - test_executions
  // - test_logs
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call setupDatabase() first.');
  }
  return pool;
}
