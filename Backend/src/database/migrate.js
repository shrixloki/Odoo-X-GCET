const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations.sql'),
      'utf8'
    );
    
    await pool.query(migrationSQL);
    console.log('✅ Database migrations completed successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();