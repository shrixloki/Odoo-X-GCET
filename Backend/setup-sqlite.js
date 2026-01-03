const fs = require('fs');
const path = require('path');
const pool = require('./src/config/database-sqlite');

async function setupSQLiteDatabase() {
  try {
    console.log('🔧 Setting up Dayflow HRMS SQLite Database...');
    
    // Read and execute migrations
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'src/database/migrations-sqlite.sql'),
      'utf8'
    );
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement.trim());
      }
    }
    
    console.log('✅ Database migrations completed successfully');
    
    // Test the connection by counting tables
    const result = await pool.query("SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    console.log(`📊 Database setup complete with ${result.rows[0].table_count} tables`);
    
    // Test admin user
    const adminTest = await pool.query('SELECT * FROM users WHERE role = ?', ['ADMIN']);
    console.log(`👤 Admin users created: ${adminTest.rows.length}`);
    
    // Test employees
    const empTest = await pool.query('SELECT COUNT(*) as emp_count FROM employees');
    console.log(`👥 Sample employees created: ${empTest.rows[0].emp_count}`);
    
    console.log('🎉 SQLite Database setup completed successfully!');
    console.log('📝 Default login credentials:');
    console.log('   Admin: admin@dayflow.com / admin123');
    console.log('   Employee: john.doe@dayflow.com / admin123');
    console.log('   HR Manager: hr.manager@dayflow.com / admin123');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupSQLiteDatabase();