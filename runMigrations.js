const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: fs.readFileSync('root.crt').toString(),
    rejectUnauthorized: false,
  },
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    
    // Read and execute the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_nda_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await client.query(migrationSQL);
    console.log('✅ Migrations completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
