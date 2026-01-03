const fc = require('fast-check');
const LeaveService = require('../src/services/leaveService');
const Leave = require('../src/models/Leave');
const Employee = require('../src/models/Employee');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const pool = require('../src/config/database-sqlite');

/**
 * Feature: hrms-backend-integration
 * Property-based tests for leave management operations
 * Tests Properties 13, 14, and 15 from the requirements
 */

describe('Leave Property Tests', () => {
  let testUsers = [];
  let testEmployees = [];

  // Helper function to generate safe weekday dates
  const generateFutureWeekdayDate = (daysFromNow = 1) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    
    // Ensure it's a weekday (Monday = 1, Friday = 5)
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }
    
    return date.toISOString().split('T')[0];
  };

  const generateFutureDate = (daysFromNow = 1) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  };

  const generateLeaveType = () => {
    return fc.constantFrom('SICK', 'CASUAL', 'ANNUAL', 'EMERGENCY');
  };

  beforeAll(async () => {
    // Clean up any existing test data first
    await pool.query('DELETE FROM leave_requests WHERE 1=1');
    await pool.query('DELETE FROM audit_logs WHERE entity_type = ?', ['LEAVE_REQUEST']);
    await pool.query('DELETE FROM employees WHERE user_id IN (SELECT id FROM users WHERE employee_id LIKE ?)', ['LEAVE_%']);
    await pool.query('DELETE FROM users WHERE employee_id LIKE ?', ['LEAVE_%']);

    // Create test users and employees for property tests
    const userData1 = {
      employee_id: 'LEAVE_EMP001',
      email: 'leave.emp1@test.com',
      password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.BoqjO6',
      full_name: 'Leave Test Employee 1',
      role: 'Employee',
      is_active: true
    };

    const userData2 = {
      employee_id: 'LEAVE_EMP002',
      email: 'leave.emp2@test.com',
      password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.BoqjO6',
      full_name: 'Leave Test Employee 2',
      role: 'Employee',
      is_active: true
    };

    const adminData = {
      employee_id: 'LEAVE_ADMIN',
      email: 'leave.admin@test.com',
      password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.BoqjO6',
      full_name: 'Leave Test Admin',
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
    await pool.query('DELETE FROM leave_requests WHERE 1=1');
    await pool.query('DELETE FROM audit_logs WHERE entity_type = ?', ['LEAVE_REQUEST']);
    for (const user of testUsers) {
      await pool.query('DELETE FROM employees WHERE user_id = ?', [user.id]);
      await pool.query('DELETE FROM users WHERE id = ?', [user.id]);
    }
  });

  beforeEach(async () => {
    // Clean leave records before each test
    await pool.query('DELETE FROM leave_requests WHERE 1=1');
    await pool.query('DELETE FROM audit_logs WHERE entity_type = ?', ['LEAVE_REQUEST']);
    
    // Add a longer delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  /**
   * Property 13: Leave Request Creation
   * Validates: Requirements 4.1
   * 
   * When an employee submits a leave request with valid data, a new leave record
   * must be created with the correct employee ID, dates, and pending status.
   */
  describe('Property 13: Leave Request Creation', () => {
    test('should create valid leave requests for all valid leave data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            leave_type: generateLeaveType(),
            start_offset: fc.integer({ min: 5, max: 30 }),
            duration: fc.integer({ min: 1, max: 5 }),
            reason: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (leaveData) => {
            // Clean up before this specific test to ensure isolation
            await pool.query('DELETE FROM leave_requests WHERE employee_id = ?', [testEmployees[0].id]);
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const employee = testEmployees[0];
            const user = testUsers[0];
            const requestedBy = user;

            // Generate weekday start date
            const start_date = generateFutureWeekdayDate(leaveData.start_offset);
            const startDate = new Date(start_date);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + leaveData.duration - 1);
            const end_date = endDate.toISOString().split('T')[0];

            try {
              const leaveRequest = await LeaveService.submitLeaveRequest(
                employee.id,
                {
                  leave_type: leaveData.leave_type,
                  start_date,
                  end_date,
                  reason: leaveData.reason
                },
                requestedBy,
                '127.0.0.1',
                'test-agent'
              );

              // Verify leave request was created
              expect(leaveRequest).toBeDefined();
              expect(leaveRequest.employee_id).toBe(employee.id);
              expect(leaveRequest.leave_type).toBe(leaveData.leave_type);
              expect(leaveRequest.start_date).toBe(start_date);
              expect(leaveRequest.end_date).toBe(end_date);
              expect(leaveRequest.reason).toBe(leaveData.reason);
              expect(leaveRequest.status).toBe('PENDING');
              expect(leaveRequest.days_requested).toBeGreaterThan(0);

              // Verify record exists in database
              const dbRecord = await Leave.findById(leaveRequest.id);
              expect(dbRecord).toBeDefined();
              expect(dbRecord.status).toBe('PENDING');

              // Verify audit log was created
              const auditLogs = await AuditLog.findByEntity('LEAVE_REQUEST', leaveRequest.id);
              expect(auditLogs.length).toBeGreaterThan(0);
              expect(auditLogs[0].action).toBe('LEAVE_REQUEST_SUBMITTED');
              expect(auditLogs[0].performed_by).toBe(requestedBy.id);

            } catch (error) {
              // Should not throw for valid data
              throw new Error(`Leave request failed for valid data: ${error.message}`);
            }
          }
        ),
        { numRuns: 25 } // Reduced runs for better isolation
      );
    });

    test('should reject leave requests with invalid dates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            leave_type: generateLeaveType(),
            reason: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (leaveData) => {
            const employee = testEmployees[1];
            const user = testUsers[1];
            const requestedBy = user;

            // Create invalid date scenario (past date)
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);
            const start_date = pastDate.toISOString().split('T')[0];
            const end_date = pastDate.toISOString().split('T')[0];

            // Should reject past dates
            await expect(
              LeaveService.submitLeaveRequest(
                employee.id,
                {
                  leave_type: leaveData.leave_type,
                  start_date,
                  end_date,
                  reason: leaveData.reason
                },
                requestedBy,
                '127.0.0.1',
                'test-agent'
              )
            ).rejects.toThrow('Leave cannot be applied for past dates');
          }
        ),
        { numRuns: 25 }
      );
    });

    test('should reject conflicting leave requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            leave_type: generateLeaveType(),
            start_offset: fc.integer({ min: 10, max: 20 }),
            reason: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (leaveData) => {
            // Clean up before this specific test
            await pool.query('DELETE FROM leave_requests WHERE employee_id = ?', [testEmployees[0].id]);
            
            const employee = testEmployees[0];
            const user = testUsers[0];
            const requestedBy = user;

            const start_date = generateFutureWeekdayDate(leaveData.start_offset);
            const startDate = new Date(start_date);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 2);
            const end_date = endDate.toISOString().split('T')[0];

            // First leave request should succeed
            const firstRequest = await LeaveService.submitLeaveRequest(
              employee.id,
              {
                leave_type: leaveData.leave_type,
                start_date,
                end_date,
                reason: leaveData.reason
              },
              requestedBy,
              '127.0.0.1',
              'test-agent'
            );

            expect(firstRequest).toBeDefined();

            // Overlapping leave request should fail
            await expect(
              LeaveService.submitLeaveRequest(
                employee.id,
                {
                  leave_type: leaveData.leave_type,
                  start_date,
                  end_date,
                  reason: 'Another reason'
                },
                requestedBy,
                '127.0.0.1',
                'test-agent'
              )
            ).rejects.toThrow('Leave request conflicts with existing approved or pending leave');
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  /**
   * Property 14: Leave Approval Workflow
   * Validates: Requirements 4.2, 4.3, 4.6
   * 
   * When an authorized user approves a pending leave request, the status
   * must be updated to approved and audit trail must be maintained.
   */
  describe('Property 14: Leave Approval Workflow', () => {
    test('should approve pending leave requests correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            leave_type: generateLeaveType(),
            start_offset: fc.integer({ min: 10, max: 25 }),
            reason: fc.string({ minLength: 10, maxLength: 100 }),
            approval_notes: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined })
          }),
          async (testData) => {
            // Clean up before this specific test
            await pool.query('DELETE FROM leave_requests WHERE employee_id = ?', [testEmployees[0].id]);
            
            const employee = testEmployees[0];
            const user = testUsers[0];
            const admin = testUsers[2]; // Admin user
            const requestedBy = user;
            const approvedBy = admin;

            const start_date = generateFutureWeekdayDate(testData.start_offset);
            const startDate = new Date(start_date);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 1);
            const end_date = endDate.toISOString().split('T')[0];

            // First submit leave request
            const leaveRequest = await LeaveService.submitLeaveRequest(
              employee.id,
              {
                leave_type: testData.leave_type,
                start_date,
                end_date,
                reason: testData.reason
              },
              requestedBy,
              '127.0.0.1',
              'test-agent'
            );

            expect(leaveRequest.status).toBe('PENDING');

            // Then approve it
            const approvedRequest = await LeaveService.approveLeaveRequest(
              leaveRequest.id,
              { approval_notes: testData.approval_notes },
              approvedBy,
              '127.0.0.1',
              'test-agent'
            );

            // Verify approval
            expect(approvedRequest).toBeDefined();
            expect(approvedRequest.status).toBe('APPROVED');
            expect(approvedRequest.approved_by).toBe(approvedBy.id);
            if (testData.approval_notes) {
              expect(approvedRequest.approval_notes).toBe(testData.approval_notes);
            }

            // Verify record in database
            const dbRecord = await Leave.findById(leaveRequest.id);
            expect(dbRecord.status).toBe('APPROVED');
            expect(dbRecord.approved_by).toBe(approvedBy.id);

            // Verify audit log for approval
            const auditLogs = await AuditLog.findByEntity('LEAVE_REQUEST', leaveRequest.id);
            const approvalLog = auditLogs.find(log => log.action === 'LEAVE_REQUEST_APPROVED');
            expect(approvalLog).toBeDefined();
            expect(approvalLog.performed_by).toBe(approvedBy.id);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should reject pending leave requests correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            leave_type: generateLeaveType(),
            start_offset: fc.integer({ min: 10, max: 25 }),
            reason: fc.string({ minLength: 10, maxLength: 100 }),
            rejection_notes: fc.string({ minLength: 5, maxLength: 50 })
          }),
          async (testData) => {
            // Clean up before this specific test
            await pool.query('DELETE FROM leave_requests WHERE employee_id = ?', [testEmployees[1].id]);
            
            const employee = testEmployees[1];
            const user = testUsers[1];
            const admin = testUsers[2]; // Admin user
            const requestedBy = user;
            const rejectedBy = admin;

            const start_date = generateFutureWeekdayDate(testData.start_offset);
            const startDate = new Date(start_date);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 1);
            const end_date = endDate.toISOString().split('T')[0];

            // First submit leave request
            const leaveRequest = await LeaveService.submitLeaveRequest(
              employee.id,
              {
                leave_type: testData.leave_type,
                start_date,
                end_date,
                reason: testData.reason
              },
              requestedBy,
              '127.0.0.1',
              'test-agent'
            );

            expect(leaveRequest.status).toBe('PENDING');

            // Then reject it
            const rejectedRequest = await LeaveService.rejectLeaveRequest(
              leaveRequest.id,
              { approval_notes: testData.rejection_notes },
              rejectedBy,
              '127.0.0.1',
              'test-agent'
            );

            // Verify rejection
            expect(rejectedRequest).toBeDefined();
            expect(rejectedRequest.status).toBe('REJECTED');
            expect(rejectedRequest.approved_by).toBe(rejectedBy.id);
            expect(rejectedRequest.approval_notes).toBe(testData.rejection_notes);

            // Verify record in database
            const dbRecord = await Leave.findById(leaveRequest.id);
            expect(dbRecord.status).toBe('REJECTED');
            expect(dbRecord.approved_by).toBe(rejectedBy.id);

            // Verify audit log for rejection
            const auditLogs = await AuditLog.findByEntity('LEAVE_REQUEST', leaveRequest.id);
            const rejectionLog = auditLogs.find(log => log.action === 'LEAVE_REQUEST_REJECTED');
            expect(rejectionLog).toBeDefined();
            expect(rejectionLog.performed_by).toBe(rejectedBy.id);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should not allow approval of non-pending requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            leave_type: generateLeaveType(),
            start_offset: fc.integer({ min: 10, max: 25 }),
            reason: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (testData) => {
            // Clean up before this specific test
            await pool.query('DELETE FROM leave_requests WHERE employee_id = ?', [testEmployees[0].id]);
            
            const employee = testEmployees[0];
            const user = testUsers[0];
            const admin = testUsers[2];
            const requestedBy = user;
            const approvedBy = admin;

            const start_date = generateFutureWeekdayDate(testData.start_offset);
            const startDate = new Date(start_date);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 1);
            const end_date = endDate.toISOString().split('T')[0];

            // Submit and approve leave request
            const leaveRequest = await LeaveService.submitLeaveRequest(
              employee.id,
              {
                leave_type: testData.leave_type,
                start_date,
                end_date,
                reason: testData.reason
              },
              requestedBy,
              '127.0.0.1',
              'test-agent'
            );

            await LeaveService.approveLeaveRequest(
              leaveRequest.id,
              { approval_notes: 'First approval' },
              approvedBy,
              '127.0.0.1',
              'test-agent'
            );

            // Second approval should fail
            await expect(
              LeaveService.approveLeaveRequest(
                leaveRequest.id,
                { approval_notes: 'Second approval' },
                approvedBy,
                '127.0.0.1',
                'test-agent'
              )
            ).rejects.toThrow('Only pending leave requests can be approved');
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  /**
   * Property 15: Leave Conflict Prevention
   * Validates: Requirements 4.4
   * 
   * The system must prevent overlapping leave requests for the same employee
   * and ensure no conflicts exist when approving leaves.
   */
  describe('Property 15: Leave Conflict Prevention', () => {
    test('should prevent overlapping leave requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            leave_type: generateLeaveType(),
            base_start_offset: fc.integer({ min: 15, max: 25 }),
            duration1: fc.integer({ min: 2, max: 4 }),
            duration2: fc.integer({ min: 2, max: 4 }),
            overlap_offset: fc.integer({ min: -2, max: 2 }),
            reason1: fc.string({ minLength: 10, maxLength: 50 }),
            reason2: fc.string({ minLength: 10, maxLength: 50 })
          }),
          async (testData) => {
            // Clean up before this specific test
            await pool.query('DELETE FROM leave_requests WHERE employee_id = ?', [testEmployees[0].id]);
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const employee = testEmployees[0];
            const user = testUsers[0];
            const requestedBy = user;

            // First leave request - ensure it's on a weekday
            const start_date1 = generateFutureWeekdayDate(testData.base_start_offset);
            const startDate1 = new Date(start_date1);
            const endDate1 = new Date(startDate1);
            endDate1.setDate(startDate1.getDate() + testData.duration1 - 1);
            const end_date1 = endDate1.toISOString().split('T')[0];

            // Second leave request (potentially overlapping)
            const startDate2 = new Date(startDate1);
            startDate2.setDate(startDate1.getDate() + testData.overlap_offset);
            
            // Ensure second date is also a weekday if it's going to be used
            while (startDate2.getDay() === 0 || startDate2.getDay() === 6) {
              startDate2.setDate(startDate2.getDate() + 1);
            }
            
            const start_date2 = startDate2.toISOString().split('T')[0];
            const endDate2 = new Date(startDate2);
            endDate2.setDate(startDate2.getDate() + testData.duration2 - 1);
            const end_date2 = endDate2.toISOString().split('T')[0];

            // Verify first request will have working days
            const workingDays1 = Leave.calculateWorkingDays(start_date1, end_date1);
            if (workingDays1 <= 0) {
              // Skip this test case if no working days
              return;
            }

            // First leave request should succeed
            const firstRequest = await LeaveService.submitLeaveRequest(
              employee.id,
              {
                leave_type: testData.leave_type,
                start_date: start_date1,
                end_date: end_date1,
                reason: testData.reason1
              },
              requestedBy,
              '127.0.0.1',
              'test-agent'
            );

            expect(firstRequest).toBeDefined();

            // Check if dates overlap
            const firstStart = new Date(start_date1);
            const firstEnd = new Date(end_date1);
            const secondStart = new Date(start_date2);
            const secondEnd = new Date(end_date2);

            const hasOverlap = (firstStart <= secondEnd && firstEnd >= secondStart);

            // Verify second request will have working days
            const workingDays2 = Leave.calculateWorkingDays(start_date2, end_date2);
            if (workingDays2 <= 0) {
              // Skip overlap test if second request has no working days
              return;
            }

            if (hasOverlap) {
              // Overlapping request should fail
              await expect(
                LeaveService.submitLeaveRequest(
                  employee.id,
                  {
                    leave_type: testData.leave_type,
                    start_date: start_date2,
                    end_date: end_date2,
                    reason: testData.reason2
                  },
                  requestedBy,
                  '127.0.0.1',
                  'test-agent'
                )
              ).rejects.toThrow('Leave request conflicts with existing approved or pending leave');
            } else {
              // Non-overlapping request should succeed
              const secondRequest = await LeaveService.submitLeaveRequest(
                employee.id,
                {
                  leave_type: testData.leave_type,
                  start_date: start_date2,
                  end_date: end_date2,
                  reason: testData.reason2
                },
                requestedBy,
                '127.0.0.1',
                'test-agent'
              );

              expect(secondRequest).toBeDefined();
              expect(secondRequest.status).toBe('PENDING');
            }
          }
        ),
        { numRuns: 25 } // Reduced runs for better reliability
      );
    });

    test('should allow non-overlapping leave requests for same employee', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            leave_type: generateLeaveType(),
            first_start_offset: fc.integer({ min: 10, max: 15 }),
            gap_days: fc.integer({ min: 5, max: 10 }),
            duration: fc.integer({ min: 1, max: 3 }),
            reason1: fc.string({ minLength: 10, maxLength: 50 }),
            reason2: fc.string({ minLength: 10, maxLength: 50 })
          }),
          async (testData) => {
            // Clean up before this specific test
            await pool.query('DELETE FROM leave_requests WHERE employee_id = ?', [testEmployees[1].id]);
            
            const employee = testEmployees[1];
            const user = testUsers[1];
            const requestedBy = user;

            // First leave request
            const start_date1 = generateFutureWeekdayDate(testData.first_start_offset);
            const startDate1 = new Date(start_date1);
            const endDate1 = new Date(startDate1);
            endDate1.setDate(startDate1.getDate() + testData.duration - 1);
            const end_date1 = endDate1.toISOString().split('T')[0];

            // Second leave request (non-overlapping)
            const start_date2 = generateFutureWeekdayDate(testData.first_start_offset + testData.duration + testData.gap_days);
            const startDate2 = new Date(start_date2);
            const endDate2 = new Date(startDate2);
            endDate2.setDate(startDate2.getDate() + testData.duration - 1);
            const end_date2 = endDate2.toISOString().split('T')[0];

            // Both requests should succeed
            const firstRequest = await LeaveService.submitLeaveRequest(
              employee.id,
              {
                leave_type: testData.leave_type,
                start_date: start_date1,
                end_date: end_date1,
                reason: testData.reason1
              },
              requestedBy,
              '127.0.0.1',
              'test-agent'
            );

            const secondRequest = await LeaveService.submitLeaveRequest(
              employee.id,
              {
                leave_type: testData.leave_type,
                start_date: start_date2,
                end_date: end_date2,
                reason: testData.reason2
              },
              requestedBy,
              '127.0.0.1',
              'test-agent'
            );

            expect(firstRequest).toBeDefined();
            expect(secondRequest).toBeDefined();
            expect(firstRequest.status).toBe('PENDING');
            expect(secondRequest.status).toBe('PENDING');

            // Verify both records exist in database
            const records = await Leave.findByEmployee(employee.id);
            expect(records.length).toBe(2);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should allow overlapping leave requests for different employees', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            leave_type: generateLeaveType(),
            start_offset: fc.integer({ min: 10, max: 20 }),
            duration: fc.integer({ min: 2, max: 4 }),
            reason1: fc.string({ minLength: 10, maxLength: 50 }),
            reason2: fc.string({ minLength: 10, maxLength: 50 })
          }),
          async (testData) => {
            // Clean up before this specific test
            await pool.query('DELETE FROM leave_requests WHERE employee_id IN (?, ?)', [testEmployees[0].id, testEmployees[1].id]);
            
            const employee1 = testEmployees[0];
            const employee2 = testEmployees[1];
            const user1 = testUsers[0];
            const user2 = testUsers[1];

            const start_date = generateFutureWeekdayDate(testData.start_offset);
            const startDate = new Date(start_date);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + testData.duration - 1);
            const end_date = endDate.toISOString().split('T')[0];

            // Both employees should be able to request leave for same dates
            const request1 = await LeaveService.submitLeaveRequest(
              employee1.id,
              {
                leave_type: testData.leave_type,
                start_date,
                end_date,
                reason: testData.reason1
              },
              user1,
              '127.0.0.1',
              'test-agent'
            );

            const request2 = await LeaveService.submitLeaveRequest(
              employee2.id,
              {
                leave_type: testData.leave_type,
                start_date,
                end_date,
                reason: testData.reason2
              },
              user2,
              '127.0.0.1',
              'test-agent'
            );

            expect(request1).toBeDefined();
            expect(request2).toBeDefined();
            expect(request1.employee_id).toBe(employee1.id);
            expect(request2.employee_id).toBe(employee2.id);
            expect(request1.start_date).toBe(start_date);
            expect(request2.start_date).toBe(start_date);

            // Verify both records exist in database
            const record1 = await Leave.findById(request1.id);
            const record2 = await Leave.findById(request2.id);

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
   * Additional Property Tests for Leave Business Logic
   */
  describe('Leave Business Logic Properties', () => {
    test('should calculate working days correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            start_offset: fc.integer({ min: 5, max: 15 }),
            duration: fc.integer({ min: 1, max: 10 })
          }),
          async (testData) => {
            const start_date = generateFutureWeekdayDate(testData.start_offset);
            const startDate = new Date(start_date);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + testData.duration - 1);
            const end_date = endDate.toISOString().split('T')[0];

            const workingDays = Leave.calculateWorkingDays(start_date, end_date);

            // Working days should be positive for weekday starts and not exceed total days
            expect(workingDays).toBeGreaterThanOrEqual(0);
            expect(workingDays).toBeLessThanOrEqual(testData.duration);

            // For a single weekday, working days should be 1
            if (testData.duration === 1) {
              const dayOfWeek = startDate.getDay();
              if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
                expect(workingDays).toBe(1);
              } else {
                expect(workingDays).toBe(0);
              }
            }

            // If we start on a weekday, we should have at least some working days
            const startDayOfWeek = startDate.getDay();
            if (startDayOfWeek !== 0 && startDayOfWeek !== 6) {
              expect(workingDays).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should validate leave dates correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            future_days: fc.integer({ min: 1, max: 30 }),
            duration: fc.integer({ min: 1, max: 5 })
          }),
          async (testData) => {
            const start_date = generateFutureDate(testData.future_days);
            const startDate = new Date(start_date);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + testData.duration - 1);
            const end_date = endDate.toISOString().split('T')[0];

            // Valid future dates should not throw
            expect(() => {
              Leave.validateLeaveDates(start_date, end_date);
            }).not.toThrow();

            // Past dates should throw
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);
            const past_date = pastDate.toISOString().split('T')[0];

            expect(() => {
              Leave.validateLeaveDates(past_date, end_date);
            }).toThrow('Leave cannot be applied for past dates');

            // End date before start date should throw (only if they're actually different)
            if (testData.duration > 1) {
              expect(() => {
                Leave.validateLeaveDates(end_date, start_date);
              }).toThrow('Start date cannot be after end date');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 16: Leave Balance Accuracy
   * Validates: Requirements 4.5
   * 
   * The system must accurately track and calculate leave balances for employees,
   * ensuring that used days, pending days, and available days are correctly computed.
   */
  describe('Property 16: Leave Balance Accuracy', () => {
    test('should accurately calculate leave balance for employees', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            leave_type: generateLeaveType(),
            approved_requests: fc.integer({ min: 0, max: 2 }),
            pending_requests: fc.integer({ min: 0, max: 1 }),
            days_per_request: fc.integer({ min: 1, max: 2 })
          }),
          async (testData) => {
            // Clean up before this specific test
            await pool.query('DELETE FROM leave_requests WHERE employee_id = ?', [testEmployees[0].id]);
            
            const employee = testEmployees[0];
            const user = testUsers[0];
            const admin = testUsers[2];
            const requestedBy = user;
            const approvedBy = admin;

            // Get leave policy to check limits
            const policyQuery = `SELECT * FROM leave_policies WHERE leave_type = ? AND is_active = 1`;
            const policyResult = await pool.query(policyQuery, [testData.leave_type]);
            
            if (policyResult.rows.length === 0) {
              // Skip if no policy exists for this leave type
              return;
            }
            
            const policy = policyResult.rows[0];
            const totalRequestedDays = (testData.approved_requests + testData.pending_requests) * testData.days_per_request;
            
            // Skip if total requested days exceed policy limit
            if (totalRequestedDays > policy.annual_limit) {
              return;
            }

            // Create approved leave requests
            const approvedRequests = [];
            for (let i = 0; i < testData.approved_requests; i++) {
              const start_date = generateFutureWeekdayDate(10 + (i * 5));
              const startDate = new Date(start_date);
              const endDate = new Date(startDate);
              endDate.setDate(startDate.getDate() + testData.days_per_request - 1);
              const end_date = endDate.toISOString().split('T')[0];

              const leaveRequest = await LeaveService.submitLeaveRequest(
                employee.id,
                {
                  leave_type: testData.leave_type,
                  start_date,
                  end_date,
                  reason: `Approved test request ${i + 1}`
                },
                requestedBy,
                '127.0.0.1',
                'test-agent'
              );

              const approved = await LeaveService.approveLeaveRequest(
                leaveRequest.id,
                { approval_notes: 'Test approval' },
                approvedBy,
                '127.0.0.1',
                'test-agent'
              );

              approvedRequests.push(approved);
            }

            // Create pending leave requests
            const pendingRequests = [];
            for (let i = 0; i < testData.pending_requests; i++) {
              const start_date = generateFutureWeekdayDate(50 + (i * 5));
              const startDate = new Date(start_date);
              const endDate = new Date(startDate);
              endDate.setDate(startDate.getDate() + testData.days_per_request - 1);
              const end_date = endDate.toISOString().split('T')[0];

              const leaveRequest = await LeaveService.submitLeaveRequest(
                employee.id,
                {
                  leave_type: testData.leave_type,
                  start_date,
                  end_date,
                  reason: `Pending test request ${i + 1}`
                },
                requestedBy,
                '127.0.0.1',
                'test-agent'
              );

              pendingRequests.push(leaveRequest);
            }

            // Calculate expected values
            const expectedApprovedDays = approvedRequests.reduce((sum, req) => sum + req.days_requested, 0);
            const expectedPendingDays = pendingRequests.reduce((sum, req) => sum + req.days_requested, 0);

            // Get leave balance
            const balance = await LeaveService.getEmployeeLeaveBalance(employee.id, user);

            // Verify balance accuracy
            expect(balance).toBeDefined();
            expect(balance.employee_id).toBe(employee.id);
            expect(balance.leave_types).toBeDefined();

            if (balance.leave_types[testData.leave_type]) {
              const typeBalance = balance.leave_types[testData.leave_type];
              
              // Verify used days match approved requests
              expect(typeBalance.used_days).toBe(expectedApprovedDays);
              
              // Verify pending days match pending requests
              expect(typeBalance.pending_days).toBe(expectedPendingDays);
              
              // Verify available days calculation
              const expectedAvailable = typeBalance.annual_limit - expectedApprovedDays - expectedPendingDays;
              expect(typeBalance.available_days).toBe(expectedAvailable);
              
              // Verify balance consistency
              expect(typeBalance.used_days + typeBalance.pending_days + typeBalance.available_days)
                .toBe(typeBalance.annual_limit);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    test('should maintain balance accuracy across multiple leave types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            requests_per_type: fc.integer({ min: 1, max: 2 }),
            days_per_request: fc.integer({ min: 1, max: 2 })
          }),
          async (testData) => {
            // Clean up before this specific test
            await pool.query('DELETE FROM leave_requests WHERE employee_id = ?', [testEmployees[1].id]);
            
            const employee = testEmployees[1];
            const user = testUsers[1];
            const admin = testUsers[2];
            const requestedBy = user;
            const approvedBy = admin;

            const leaveTypes = ['SICK', 'CASUAL', 'ANNUAL'];
            const createdRequests = {};

            // Create requests for each leave type
            for (const leaveType of leaveTypes) {
              createdRequests[leaveType] = [];
              
              for (let i = 0; i < testData.requests_per_type; i++) {
                const start_date = generateFutureWeekdayDate(10 + (leaveTypes.indexOf(leaveType) * 10) + (i * 5));
                const startDate = new Date(start_date);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + testData.days_per_request - 1);
                const end_date = endDate.toISOString().split('T')[0];

                const leaveRequest = await LeaveService.submitLeaveRequest(
                  employee.id,
                  {
                    leave_type: leaveType,
                    start_date,
                    end_date,
                    reason: `Test ${leaveType} request ${i + 1}`
                  },
                  requestedBy,
                  '127.0.0.1',
                  'test-agent'
                );

                // Approve half of the requests
                if (i % 2 === 0) {
                  const approved = await LeaveService.approveLeaveRequest(
                    leaveRequest.id,
                    { approval_notes: 'Test approval' },
                    approvedBy,
                    '127.0.0.1',
                    'test-agent'
                  );
                  createdRequests[leaveType].push({ ...approved, status: 'APPROVED' });
                } else {
                  createdRequests[leaveType].push({ ...leaveRequest, status: 'PENDING' });
                }
              }
            }

            // Get leave balance
            const balance = await LeaveService.getEmployeeLeaveBalance(employee.id, user);

            // Verify balance for each leave type
            for (const leaveType of leaveTypes) {
              if (balance.leave_types[leaveType]) {
                const typeBalance = balance.leave_types[leaveType];
                const requests = createdRequests[leaveType];
                
                const expectedApproved = requests
                  .filter(req => req.status === 'APPROVED')
                  .reduce((sum, req) => sum + req.days_requested, 0);
                
                const expectedPending = requests
                  .filter(req => req.status === 'PENDING')
                  .reduce((sum, req) => sum + req.days_requested, 0);

                expect(typeBalance.used_days).toBe(expectedApproved);
                expect(typeBalance.pending_days).toBe(expectedPending);
                
                // Verify balance consistency for this type
                expect(typeBalance.used_days + typeBalance.pending_days + typeBalance.available_days)
                  .toBe(typeBalance.annual_limit);
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should update balance when leave requests are cancelled', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            leave_type: generateLeaveType(),
            initial_requests: fc.integer({ min: 2, max: 4 }),
            days_per_request: fc.integer({ min: 1, max: 2 })
          }),
          async (testData) => {
            // Clean up before this specific test
            await pool.query('DELETE FROM leave_requests WHERE employee_id = ?', [testEmployees[0].id]);
            
            const employee = testEmployees[0];
            const user = testUsers[0];
            const requestedBy = user;

            // Create initial leave requests
            const requests = [];
            for (let i = 0; i < testData.initial_requests; i++) {
              const start_date = generateFutureWeekdayDate(15 + (i * 5));
              const startDate = new Date(start_date);
              const endDate = new Date(startDate);
              endDate.setDate(startDate.getDate() + testData.days_per_request - 1);
              const end_date = endDate.toISOString().split('T')[0];

              const leaveRequest = await LeaveService.submitLeaveRequest(
                employee.id,
                {
                  leave_type: testData.leave_type,
                  start_date,
                  end_date,
                  reason: `Test request ${i + 1}`
                },
                requestedBy,
                '127.0.0.1',
                'test-agent'
              );

              requests.push(leaveRequest);
            }

            // Get initial balance
            const initialBalance = await LeaveService.getEmployeeLeaveBalance(employee.id, user);
            const initialTypeBalance = initialBalance.leave_types[testData.leave_type];
            
            if (initialTypeBalance) {
              const initialPending = initialTypeBalance.pending_days;
              const initialAvailable = initialTypeBalance.available_days;

              // Cancel the first request
              const requestToCancel = requests[0];
              await LeaveService.cancelLeaveRequest(
                requestToCancel.id,
                requestedBy,
                '127.0.0.1',
                'test-agent'
              );

              // Get updated balance
              const updatedBalance = await LeaveService.getEmployeeLeaveBalance(employee.id, user);
              const updatedTypeBalance = updatedBalance.leave_types[testData.leave_type];

              if (updatedTypeBalance) {
                // Verify that pending days decreased by the cancelled request days
                expect(updatedTypeBalance.pending_days).toBe(initialPending - requestToCancel.days_requested);
                
                // Verify that available days increased by the cancelled request days
                expect(updatedTypeBalance.available_days).toBe(initialAvailable + requestToCancel.days_requested);
                
                // Verify balance consistency
                expect(updatedTypeBalance.used_days + updatedTypeBalance.pending_days + updatedTypeBalance.available_days)
                  .toBe(updatedTypeBalance.annual_limit);
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});