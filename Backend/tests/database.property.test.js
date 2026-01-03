const fc = require('fast-check');
const pool = require('../src/config/database');

describe('Database Constraints Property Tests', () => {
  beforeEach(async () => {
    // Clean up test data before each test
    await global.testUtils.cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await global.testUtils.cleanupTestData();
  });

  describe('Property 19: Referential Integrity Enforcement', () => {
    test('Feature: hrms-backend-integration, Property 19: For any database operation, the system should maintain referential integrity through foreign key constraints', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            employee_id: fc.string({ minLength: 5, maxLength: 10 }).map(s => `TEST${s}`),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 20 }),
            full_name: fc.string({ minLength: 3, maxLength: 50 }),
            department: fc.constantFrom('IT', 'HR', 'Finance', 'Operations'),
            designation: fc.string({ minLength: 3, maxLength: 30 })
          }),
          async (userData) => {
            // Create a user first
            const userResult = await pool.query(
              'INSERT INTO users (employee_id, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id',
              [userData.employee_id, userData.email, userData.password, 'EMPLOYEE']
            );
            
            const userId = userResult.insertId;
            
            // Create employee with valid user_id
            const employeeResult = await pool.query(
              'INSERT INTO employees (user_id, full_name, department, designation, joining_date) VALUES (?, ?, ?, ?, date("now")) RETURNING id',
              [userId, userData.full_name, userData.department, userData.designation]
            );
            
            const employeeId = employeeResult.insertId;
            
            // Test 1: Valid foreign key should work
            expect(employeeId).toBeDefined();
            
            // Test 2: Invalid foreign key should fail
            try {
              await pool.query(
                'INSERT INTO employees (user_id, full_name, department, designation, joining_date) VALUES (?, ?, ?, ?, date("now"))',
                [99999, userData.full_name, userData.department, userData.designation]
              );
              // If we reach here, the constraint didn't work
              expect(true).toBe(false);
            } catch (error) {
              // This should happen - foreign key constraint violation
              expect(error.message).toContain('FOREIGN KEY constraint failed');
            }
            
            // Test 3: Cascade delete should work
            await pool.query('DELETE FROM users WHERE id = ?', [userId]);
            
            // Employee should be deleted due to CASCADE
            const deletedEmployee = await pool.query('SELECT * FROM employees WHERE id = ?', [employeeId]);
            expect(deletedEmployee.rows.length).toBe(0);
          }
        ),
        { numRuns: 10 } // Reduced for faster execution
      );
    });

    test('Attendance foreign key constraints should be enforced', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            employee_id: fc.string({ minLength: 5, maxLength: 10 }).map(s => `TEST${s}`),
            email: fc.emailAddress(),
            full_name: fc.string({ minLength: 3, maxLength: 50 })
          }),
          async (userData) => {
            // Create user and employee
            const userResult = await pool.query(
              'INSERT INTO users (employee_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
              [userData.employee_id, userData.email, 'hashedpass', 'EMPLOYEE']
            );
            
            const employeeResult = await pool.query(
              'INSERT INTO employees (user_id, full_name, department, designation, joining_date) VALUES (?, ?, ?, ?, date("now"))',
              [userResult.insertId, userData.full_name, 'IT', 'Developer']
            );
            
            const employeeId = employeeResult.insertId;
            
            // Valid attendance record should work
            await pool.query(
              'INSERT INTO attendance (employee_id, date, check_in_time, status) VALUES (?, date("now"), "09:00:00", "PRESENT")',
              [employeeId]
            );
            
            // Invalid employee_id should fail
            try {
              await pool.query(
                'INSERT INTO attendance (employee_id, date, check_in_time, status) VALUES (?, date("now"), "09:00:00", "PRESENT")',
                [99999]
              );
              expect(true).toBe(false); // Should not reach here
            } catch (error) {
              expect(error.message).toContain('FOREIGN KEY constraint failed');
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    test('Leave requests foreign key constraints should be enforced', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            employee_id: fc.string({ minLength: 5, maxLength: 10 }).map(s => `TEST${s}`),
            email: fc.emailAddress(),
            full_name: fc.string({ minLength: 3, maxLength: 50 }),
            leave_type: fc.constantFrom('SICK', 'CASUAL', 'ANNUAL'),
            reason: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (userData) => {
            // Create user and employee
            const userResult = await pool.query(
              'INSERT INTO users (employee_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
              [userData.employee_id, userData.email, 'hashedpass', 'EMPLOYEE']
            );
            
            const employeeResult = await pool.query(
              'INSERT INTO employees (user_id, full_name, department, designation, joining_date) VALUES (?, ?, ?, ?, date("now"))',
              [userResult.insertId, userData.full_name, 'IT', 'Developer']
            );
            
            const employeeId = employeeResult.insertId;
            
            // Valid leave request should work
            await pool.query(
              'INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_requested, reason) VALUES (?, ?, date("now"), date("now", "+1 day"), 1, ?)',
              [employeeId, userData.leave_type, userData.reason]
            );
            
            // Invalid employee_id should fail
            try {
              await pool.query(
                'INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_requested, reason) VALUES (?, ?, date("now"), date("now", "+1 day"), 1, ?)',
                [99999, userData.leave_type, userData.reason]
              );
              expect(true).toBe(false); // Should not reach here
            } catch (error) {
              expect(error.message).toContain('FOREIGN KEY constraint failed');
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});