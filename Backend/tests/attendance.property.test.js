const fc = require('fast-check');
const AttendanceService = require('../src/services/attendanceService');
const Attendance = require('../src/models/Attendance');
const Employee = require('../src/models/Employee');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const pool = require('../src/config/database-sqlite');

/**
 * Feature: hrms-backend-integration
 * Property-based tests for attendance management operations
 * Tests Properties 9, 10, and 11 from the requirements
 */

describe('Attendance Property Tests', () => {
  let testUsers = [];
  let testEmployees = [];

  // Helper function to generate safe dates
  const generateSafeDate = () => {
    const dates = [
      '2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05',
      '2024-02-01', '2024-02-02', '2024-02-03', '2024-02-04', '2024-02-05',
      '2024-03-01', '2024-03-02', '2024-03-03', '2024-03-04', '2024-03-05'
    ];
    return fc.constantFrom(...dates);
  };

  beforeAll(async () => {
    // Clean up any existing test data first
    await pool.query('DELETE FROM attendance WHERE 1=1');
    await pool.query('DELETE FROM audit_logs WHERE entity_type = ?', ['ATTENDANCE']);
    await pool.query('DELETE FROM employees WHERE user_id IN (SELECT id FROM users WHERE employee_id LIKE ?)', ['PROP_%']);
    await pool.query('DELETE FROM users WHERE employee_id LIKE ?', ['PROP_%']);

    // Create test users and employees for property tests
    const userData1 = {
      employee_id: 'PROP_EMP001',
      email: 'prop.emp1@test.com',
      password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.BoqjO6',
      full_name: 'Property Test Employee 1',
      role: 'Employee',
      is_active: true
    };

    const userData2 = {
      employee_id: 'PROP_EMP002',
      email: 'prop.emp2@test.com',
      password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.BoqjO6',
      full_name: 'Property Test Employee 2',
      role: 'Employee',
      is_active: true
    };

    const adminData = {
      employee_id: 'PROP_ADMIN',
      email: 'prop.admin@test.com',
      password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.BoqjO6',
      full_name: 'Property Test Admin',
      role: 'Admin',
      is_active: true
    };

    const user1 = await User.create(userData1);
    const user2 = await User.create(userData2);
    const admin = await User.create(adminData);

    const employee1 = await Employee.create({
      user_id: user1.id,
      department: 'IT',
      designation: 'Developer',
      joining_date: '2024-01-01',
      salary: 50000
    });

    const employee2 = await Employee.create({
      user_id: user2.id,
      department: 'HR',
      designation: 'HR Executive',
      joining_date: '2024-01-01',
      salary: 45000
    });

    const adminEmployee = await Employee.create({
      user_id: admin.id,
      department: 'IT',
      designation: 'System Admin',
      joining_date: '2024-01-01',
      salary: 80000
    });

    testUsers = [user1, user2, admin];
    testEmployees = [employee1, employee2, adminEmployee];
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM attendance WHERE 1=1');
    await pool.query('DELETE FROM audit_logs WHERE entity_type = ?', ['ATTENDANCE']);
    for (const user of testUsers) {
      await pool.query('DELETE FROM employees WHERE user_id = ?', [user.id]);
      await pool.query('DELETE FROM users WHERE id = ?', [user.id]);
    }
  });

  beforeEach(async () => {
    // Clean attendance records before each test
    await pool.query('DELETE FROM attendance WHERE 1=1');
    await pool.query('DELETE FROM audit_logs WHERE entity_type = ?', ['ATTENDANCE']);
  });

  /**
   * Property 9: Check-in Record Creation
   * Validates: Requirements 3.1
   * 
   * When an employee checks in with valid data, a new attendance record
   * must be created with the correct employee ID, date, and check-in time.
   */
  describe('Property 9: Check-in Record Creation', () => {
    test('should create valid attendance records for all valid check-in data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            date: generateSafeDate(),
            check_in_time: fc.integer({ min: 6, max: 11 })
              .chain(hour => fc.integer({ min: 0, max: 59 })
                .map(minute => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`)),
            notes: fc.option(fc.string({ maxLength: 100 }), { nil: undefined })
          }),
          async (checkInData) => {
            const employee = testEmployees[0];
            const user = testUsers[0];
            const performedBy = user;

            try {
              const attendance = await AttendanceService.checkIn(
                employee.id,
                checkInData,
                performedBy,
                '127.0.0.1',
                'test-agent'
              );

              // Verify attendance record was created
              expect(attendance).toBeDefined();
              expect(attendance.employee_id).toBe(employee.id);
              expect(attendance.date).toBe(checkInData.date);
              expect(attendance.check_in_time).toBe(checkInData.check_in_time);
              expect(attendance.check_out_time).toBeNull();
              expect(attendance.work_hours).toBe(0);
              expect(['PRESENT', 'LATE']).toContain(attendance.status);

              // Verify record exists in database
              const dbRecord = await Attendance.findByEmployeeAndDate(employee.id, checkInData.date);
              expect(dbRecord).toBeDefined();
              expect(dbRecord.check_in_time).toBe(checkInData.check_in_time);

              // Verify audit log was created
              const auditLogs = await AuditLog.findByEntity('ATTENDANCE', attendance.id);
              expect(auditLogs.length).toBeGreaterThan(0);
              expect(auditLogs[0].action).toBe('ATTENDANCE_CHECK_IN');
              expect(auditLogs[0].performed_by).toBe(performedBy.id);

            } catch (error) {
              // Should not throw for valid data
              throw new Error(`Check-in failed for valid data: ${error.message}`);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should reject duplicate check-ins for the same date', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            date: generateSafeDate(),
            check_in_time1: fc.integer({ min: 8, max: 10 })
              .chain(hour => fc.integer({ min: 0, max: 59 })
                .map(minute => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`)),
            check_in_time2: fc.integer({ min: 8, max: 10 })
              .chain(hour => fc.integer({ min: 0, max: 59 })
                .map(minute => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`))
          }),
          async (testData) => {
            const employee = testEmployees[1];
            const user = testUsers[1];
            const performedBy = user;

            // First check-in should succeed
            const firstCheckIn = await AttendanceService.checkIn(
              employee.id,
              { date: testData.date, check_in_time: testData.check_in_time1 },
              performedBy,
              '127.0.0.1',
              'test-agent'
            );

            expect(firstCheckIn).toBeDefined();

            // Second check-in for same date should fail
            await expect(
              AttendanceService.checkIn(
                employee.id,
                { date: testData.date, check_in_time: testData.check_in_time2 },
                performedBy,
                '127.0.0.1',
                'test-agent'
              )
            ).rejects.toThrow('Employee already checked in for this date');
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  /**
   * Property 10: Check-out Record Completion
   * Validates: Requirements 3.2, 3.4
   * 
   * When an employee checks out after checking in, the attendance record
   * must be updated with check-out time, calculated work hours, and final status.
   */
  describe('Property 10: Check-out Record Completion', () => {
    test('should complete attendance records with valid check-out data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            date: generateSafeDate(),
            check_in_hour: fc.integer({ min: 8, max: 10 }),
            check_out_hour: fc.integer({ min: 16, max: 20 }),
            notes: fc.option(fc.string({ maxLength: 100 }), { nil: undefined })
          }),
          async (testData) => {
            const employee = testEmployees[0];
            const user = testUsers[0];
            const performedBy = user;

            const check_in_time = `${testData.check_in_hour.toString().padStart(2, '0')}:00:00`;
            const check_out_time = `${testData.check_out_hour.toString().padStart(2, '0')}:00:00`;

            // First check-in
            const checkInRecord = await AttendanceService.checkIn(
              employee.id,
              { date: testData.date, check_in_time, notes: testData.notes },
              performedBy,
              '127.0.0.1',
              'test-agent'
            );

            expect(checkInRecord.check_out_time).toBeNull();
            expect(checkInRecord.work_hours).toBe(0);

            // Then check-out
            const checkOutRecord = await AttendanceService.checkOut(
              employee.id,
              { date: testData.date, check_out_time, notes: testData.notes },
              performedBy,
              '127.0.0.1',
              'test-agent'
            );

            // Verify check-out completion
            expect(checkOutRecord).toBeDefined();
            expect(checkOutRecord.check_out_time).toBe(check_out_time);
            expect(checkOutRecord.work_hours).toBeGreaterThan(0);
            expect(['PRESENT', 'LATE', 'HALF_DAY']).toContain(checkOutRecord.status);

            // Verify work hours calculation
            const expectedHours = testData.check_out_hour - testData.check_in_hour;
            expect(checkOutRecord.work_hours).toBeCloseTo(expectedHours, 1);

            // Verify record in database
            const dbRecord = await Attendance.findByEmployeeAndDate(employee.id, testData.date);
            expect(dbRecord.check_out_time).toBe(check_out_time);
            expect(dbRecord.work_hours).toBeGreaterThan(0);

            // Verify audit log for check-out
            const auditLogs = await AuditLog.findByEntity('ATTENDANCE', checkOutRecord.id);
            const checkOutLog = auditLogs.find(log => log.action === 'ATTENDANCE_CHECK_OUT');
            expect(checkOutLog).toBeDefined();
            expect(checkOutLog.performed_by).toBe(performedBy.id);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should reject check-out without prior check-in', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            date: generateSafeDate(),
            check_out_time: fc.integer({ min: 16, max: 20 })
              .chain(hour => fc.integer({ min: 0, max: 59 })
                .map(minute => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`))
          }),
          async (testData) => {
            const employee = testEmployees[1];
            const user = testUsers[1];
            const performedBy = user;

            // Attempt check-out without check-in should fail
            await expect(
              AttendanceService.checkOut(
                employee.id,
                { date: testData.date, check_out_time: testData.check_out_time },
                performedBy,
                '127.0.0.1',
                'test-agent'
              )
            ).rejects.toThrow('No check-in record found for this date');
          }
        ),
        { numRuns: 25 }
      );
    });

    test('should reject duplicate check-outs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            date: generateSafeDate(),
            check_in_time: fc.constant('09:00:00'),
            check_out_time1: fc.constant('17:00:00'),
            check_out_time2: fc.constant('18:00:00')
          }),
          async (testData) => {
            const employee = testEmployees[0];
            const user = testUsers[0];
            const performedBy = user;

            // Check-in first
            await AttendanceService.checkIn(
              employee.id,
              { date: testData.date, check_in_time: testData.check_in_time },
              performedBy,
              '127.0.0.1',
              'test-agent'
            );

            // First check-out should succeed
            const firstCheckOut = await AttendanceService.checkOut(
              employee.id,
              { date: testData.date, check_out_time: testData.check_out_time1 },
              performedBy,
              '127.0.0.1',
              'test-agent'
            );

            expect(firstCheckOut.check_out_time).toBe(testData.check_out_time1);

            // Second check-out should fail
            await expect(
              AttendanceService.checkOut(
                employee.id,
                { date: testData.date, check_out_time: testData.check_out_time2 },
                performedBy,
                '127.0.0.1',
                'test-agent'
              )
            ).rejects.toThrow('Employee already checked out for this date');
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  /**
   * Property 11: Single Daily Check-in Enforcement
   * Validates: Requirements 3.3
   * 
   * The system must enforce that each employee can only have one
   * check-in record per day, preventing duplicate attendance entries.
   */
  describe('Property 11: Single Daily Check-in Enforcement', () => {
    test('should enforce unique daily attendance records per employee', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            date: generateSafeDate(),
            attempts: fc.array(
              fc.record({
                check_in_time: fc.integer({ min: 7, max: 11 })
                  .chain(hour => fc.integer({ min: 0, max: 59 })
                    .map(minute => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`)),
                notes: fc.option(fc.string({ maxLength: 50 }), { nil: undefined })
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          async (testData) => {
            const employee = testEmployees[0];
            const user = testUsers[0];
            const performedBy = user;

            let successfulCheckIns = 0;
            let failedCheckIns = 0;

            // Attempt multiple check-ins for the same date
            for (const attempt of testData.attempts) {
              try {
                await AttendanceService.checkIn(
                  employee.id,
                  { 
                    date: testData.date, 
                    check_in_time: attempt.check_in_time,
                    notes: attempt.notes
                  },
                  performedBy,
                  '127.0.0.1',
                  'test-agent'
                );
                successfulCheckIns++;
              } catch (error) {
                if (error.message.includes('already checked in')) {
                  failedCheckIns++;
                } else {
                  throw error; // Unexpected error
                }
              }
            }

            // Only one check-in should succeed
            expect(successfulCheckIns).toBe(1);
            expect(failedCheckIns).toBe(testData.attempts.length - 1);

            // Verify only one record exists in database
            const records = await Attendance.findByEmployee(employee.id, {
              start_date: testData.date,
              end_date: testData.date
            });
            expect(records.length).toBe(1);

            // Verify the record has the first attempt's data
            expect(records[0].date).toBe(testData.date);
            expect(records[0].check_in_time).toBe(testData.attempts[0].check_in_time);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should allow check-ins for different dates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              date: generateSafeDate(),
              check_in_time: fc.integer({ min: 8, max: 10 })
                .chain(hour => fc.integer({ min: 0, max: 59 })
                  .map(minute => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`))
            }),
            { minLength: 2, maxLength: 3 }
          ).filter(attempts => {
            // Ensure all dates are unique
            const dates = attempts.map(a => a.date);
            return new Set(dates).size === dates.length;
          }),
          async (checkInAttempts) => {
            const employee = testEmployees[1];
            const user = testUsers[1];
            const performedBy = user;

            const results = [];

            // Attempt check-ins for different dates
            for (const attempt of checkInAttempts) {
              const result = await AttendanceService.checkIn(
                employee.id,
                attempt,
                performedBy,
                '127.0.0.1',
                'test-agent'
              );
              results.push(result);
            }

            // All check-ins should succeed
            expect(results.length).toBe(checkInAttempts.length);

            // Verify all records exist in database
            for (let i = 0; i < checkInAttempts.length; i++) {
              const record = await Attendance.findByEmployeeAndDate(
                employee.id, 
                checkInAttempts[i].date
              );
              expect(record).toBeDefined();
              expect(record.check_in_time).toBe(checkInAttempts[i].check_in_time);
            }

            // Verify total count matches
            const allRecords = await Attendance.findByEmployee(employee.id);
            expect(allRecords.length).toBeGreaterThanOrEqual(checkInAttempts.length);
          }
        ),
        { numRuns: 25 }
      );
    });

    test('should allow different employees to check-in on same date', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            date: generateSafeDate(),
            check_in_times: fc.array(
              fc.integer({ min: 8, max: 10 })
                .chain(hour => fc.integer({ min: 0, max: 59 })
                  .map(minute => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`)),
              { minLength: 2, maxLength: 2 }
            )
          }),
          async (testData) => {
            const employee1 = testEmployees[0];
            const employee2 = testEmployees[1];
            const user1 = testUsers[0];
            const user2 = testUsers[1];

            // Both employees should be able to check-in on the same date
            const result1 = await AttendanceService.checkIn(
              employee1.id,
              { date: testData.date, check_in_time: testData.check_in_times[0] },
              user1,
              '127.0.0.1',
              'test-agent'
            );

            const result2 = await AttendanceService.checkIn(
              employee2.id,
              { date: testData.date, check_in_time: testData.check_in_times[1] },
              user2,
              '127.0.0.1',
              'test-agent'
            );

            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
            expect(result1.employee_id).toBe(employee1.id);
            expect(result2.employee_id).toBe(employee2.id);
            expect(result1.date).toBe(testData.date);
            expect(result2.date).toBe(testData.date);

            // Verify both records exist in database
            const record1 = await Attendance.findByEmployeeAndDate(employee1.id, testData.date);
            const record2 = await Attendance.findByEmployeeAndDate(employee2.id, testData.date);

            expect(record1).toBeDefined();
            expect(record2).toBeDefined();
            expect(record1.employee_id).toBe(employee1.id);
            expect(record2.employee_id).toBe(employee2.id);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional Property Tests for Attendance Business Logic
   */
  describe('Attendance Business Logic Properties', () => {
    test('should calculate work hours correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            date: generateSafeDate(),
            check_in_hour: fc.integer({ min: 6, max: 12 }),
            work_duration: fc.integer({ min: 1, max: 12 })
          }),
          async (testData) => {
            const employee = testEmployees[0];
            const user = testUsers[0];
            const performedBy = user;

            const check_in_time = `${testData.check_in_hour.toString().padStart(2, '0')}:00:00`;
            const check_out_hour = testData.check_in_hour + testData.work_duration;
            const check_out_time = `${check_out_hour.toString().padStart(2, '0')}:00:00`;

            // Skip if check-out time would be invalid (>23:59)
            if (check_out_hour > 23) return;

            // Check-in
            await AttendanceService.checkIn(
              employee.id,
              { date: testData.date, check_in_time },
              performedBy,
              '127.0.0.1',
              'test-agent'
            );

            // Check-out
            const result = await AttendanceService.checkOut(
              employee.id,
              { date: testData.date, check_out_time },
              performedBy,
              '127.0.0.1',
              'test-agent'
            );

            // Verify work hours calculation
            expect(result.work_hours).toBeCloseTo(testData.work_duration, 1);

            // Verify status determination based on work hours
            if (testData.work_duration >= 8) {
              expect(['PRESENT', 'LATE']).toContain(result.status);
            } else if (testData.work_duration >= 4) {
              expect(['PRESENT', 'LATE', 'HALF_DAY']).toContain(result.status);
            } else {
              expect(result.status).toBe('HALF_DAY');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should determine status correctly based on check-in time', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            date: generateSafeDate(),
            check_in_hour: fc.integer({ min: 6, max: 12 }),
            check_in_minute: fc.integer({ min: 0, max: 59 })
          }),
          async (testData) => {
            const employee = testEmployees[1];
            const user = testUsers[1];
            const performedBy = user;

            const check_in_time = `${testData.check_in_hour.toString().padStart(2, '0')}:${testData.check_in_minute.toString().padStart(2, '0')}:00`;

            const result = await AttendanceService.checkIn(
              employee.id,
              { date: testData.date, check_in_time },
              performedBy,
              '127.0.0.1',
              'test-agent'
            );

            // Verify status determination
            const checkInDateTime = new Date(`1970-01-01T${check_in_time}`);
            const standardStart = new Date('1970-01-01T09:00:00');
            const lateThreshold = new Date('1970-01-01T09:15:00');

            if (checkInDateTime > lateThreshold) {
              expect(result.status).toBe('LATE');
            } else {
              expect(result.status).toBe('PRESENT');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});