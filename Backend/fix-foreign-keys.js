const pool = require('./src/config/database-sqlite');

async function fixForeignKeys() {
  try {
    console.log('Recreating attendance table with proper foreign keys...');
    
    // Enable foreign key constraints
    await pool.query('PRAGMA foreign_keys = ON');
    
    // Create a backup table
    await pool.query(`
      CREATE TABLE attendance_backup AS 
      SELECT * FROM attendance
    `);
    
    // Drop the original table
    await pool.query('DROP TABLE attendance');
    
    // Recreate the table with proper foreign key constraints
    await pool.query(`
      CREATE TABLE attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        check_in_time TIME,
        check_out_time TIME,
        work_hours DECIMAL(5,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE')),
        notes TEXT,
        leave_request_id INTEGER REFERENCES leave_requests(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, date)
      )
    `);
    
    // Restore data from backup
    await pool.query(`
      INSERT INTO attendance (id, employee_id, date, check_in_time, check_out_time, work_hours, status, notes, created_at, leave_request_id)
      SELECT id, employee_id, date, check_in_time, check_out_time, work_hours, status, notes, created_at, 
             CASE WHEN id IN (SELECT id FROM attendance_backup) THEN NULL ELSE NULL END as leave_request_id
      FROM attendance_backup
    `);
    
    // Drop the backup table
    await pool.query('DROP TABLE attendance_backup');
    
    // Create index for better performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date)');
    
    console.log('✅ Successfully recreated attendance table with foreign keys');
    
    // Verify foreign keys
    const fkList = await pool.query("PRAGMA foreign_key_list(attendance)");
    console.log('Foreign keys for attendance table:');
    fkList.rows.forEach(row => {
      console.log(`  - ${row.from} -> ${row.table}.${row.to}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to fix foreign keys:', error);
    process.exit(1);
  }
}

fixForeignKeys();