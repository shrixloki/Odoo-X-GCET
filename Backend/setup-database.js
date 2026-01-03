const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  console.log('🔧 Setting up Dayflow HRMS Database...');
  
  // First, connect to postgres database to create our database
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres', // Connect to default postgres database
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    // Check if database exists, create if not
    const dbName = process.env.DB_NAME || 'dayflow_hrms';
    const checkDbQuery = `SELECT 1 FROM pg_database WHERE datname = $1`;
    const dbExists = await adminPool.query(checkDbQuery, [dbName]);
    
    if (dbExists.rows.length === 0) {
      console.log(`📦 Creating database: ${dbName}`);
      await adminPool.query(`CREATE DATABASE ${dbName}`);
      console.log('✅ Database created successfully');
    } else {
      console.log(`📦 Database ${dbName} already exists`);
    }
    
    await adminPool.end();
    
    // Now connect to our database and run migrations
    const appPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'dayflow_hrms',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });
    
    console.log('🔄 Running database migrations...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'src/database/migrations.sql'),
      'utf8'
    );
    
    await appPool.query(migrationSQL);
    console.log('✅ Database migrations completed successfully');
    
    // Test the connection
    const result = await appPool.query('SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = \'public\'');
    console.log(`📊 Database setup complete with ${result.rows[0].table_count} tables`);
    
    await appPool.end();
    console.log('🎉 Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 PostgreSQL Connection Tips:');
      console.log('1. Make sure PostgreSQL is installed and running');
      console.log('2. Check your database credentials in .env file');
      console.log('3. Verify PostgreSQL is listening on the correct port');
      console.log('4. For Windows: Start PostgreSQL service');
      console.log('5. For macOS: brew services start postgresql');
      console.log('6. For Linux: sudo systemctl start postgresql');
    }
    
    process.exit(1);
  }
}

setupDatabase();