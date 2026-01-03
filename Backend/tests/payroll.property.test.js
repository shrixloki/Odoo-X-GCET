const fc = require('fast-check');
const PayrollService = require('../src/services/payrollService');
const Payroll = require('../src/models/Payroll');
const SalaryStructure = require('../src/models/SalaryStructure');
const Employee = require('../src/models/Employee');
const User = require('../src/models/User');
const Attendance = require('../src/models/Attendance');
const Leave = require('../src/models/Leave');
const pool = require('../src/config/database-sqlite');
const moment = require('moment');

describe('Payroll Property Tests', () => {
  let testUsers = [];
  let testEmployees = [];
  let testSalaryStructures = [];

  beforeAll(async () => {
    // Create test users and employees for payroll testing
    for (let i = 0; i < 5; i++) {
      const userData = {
        employee_id: `PAYROLL_TEST_${i}`,
        email: `payroll.test${i}@example.com`,
        password: 'TestPassword123!',
        full_name: `Test User ${i}`,
        role: 'Employee'
      };
      
      const user = await User.create(userData);
      testUsers.push(user);
      
      const employeeData = {
        user_id: user.id,
        full_name: `Test Employee ${i}`,
        department: 'Engineering',
        position: 'Software Developer',
        hire_date: '2023-01-01',
        phone: `555-000${i}`,
        address: `${i} Test Street`
      };
      
      const employee = await Employee.create(employeeData);
      testEmployees.push(employee);
      
      // Create salary structure for each employee
      const salaryData = {
        employee_id: employee.id,
        basic_salary: 50000 + (i * 10000), // Varying salaries
        allowances: {
          transport: 2000,
          meal: 1500,
          medical: 3000
        },
        deductions: {
          tax: '10%',
          insurance: 1000
        },
        effective_from: '2023-01-01'
      };
      
      const salaryStructure = await SalaryStructure.create(salaryData);
      testSalaryStructures.push(salaryStructure);
    }
  });

  afterAll(async () => {
    // Clean up test data
    for (const employee of testEmployees) {
      await pool.query('DELETE FROM payroll WHERE employee_id = $1', [employee.id]);
      await pool.query('DELETE FROM salary_structures WHERE employee_id = $1', [employee.id]);
      await pool.query('DELETE FROM attendance WHERE employee_id = $1', [employee.id]);
      await pool.query('DELETE FROM leave_requests WHERE employee_id = $1', [employee.id]);
    }
    
    for (const employee of testEmployees) {
      await Employee.delete(employee.id);
    }
    
    for (const user of testUsers) {
      await User.delete(user.id);
    }
  });

  beforeEach(async () => {
    // Clean payroll and attendance data before each test
    for (const employee of testEmployees) {
      await pool.query('DELETE FROM payroll WHERE employee_id = $1', [employee.id]);
      await pool.query('DELETE FROM attendance WHERE employee_id = $1', [employee.id]);
      await pool.query('DELETE FROM leave_requests WHERE employee_id = $1', [employee.id]);
    }
  });

  /**
   * Property 22: Attendance-Based Payroll Calculation
   * Validates: Requirements 7.1, 7.6
   * 
   * This property ensures that payroll calculations are accurately based on attendance data.
   * The net salary should be proportional to the attendance ratio (present days / working days).
   */
  test('Property 22: Attendance-Based Payroll Calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 12 }), // month
        fc.integer({ min: 2023, max: 2024 }), // year
        fc.integer({ min: 0, max: testEmployees.length - 1 }), // employee index
        fc.integer({ min: 5, max: 22 }), // present days (out of ~22 working days)
        async (month, year, employeeIndex, presentDays) => {
          const employee = testEmployees[employeeIndex];
          const salaryStructure = testSalaryStructures[employeeIndex];
          
          // Calculate working days for the month
          const startDate = moment(`${year}-${month}-01`).startOf('month');
          const endDate = moment(startDate).endOf('month');
          const workingDays = Payroll.calculateWorkingDays(startDate, endDate);
          
          // Ensure present days doesn't exceed working days
          const actualPresentDays = Math.min(presentDays, workingDays);
          
          // Create attendance records
          const current = moment(startDate);
          let dayCount = 0;
          
          while (current.isSameOrBefore(endDate) && dayCount < workingDays) {
            // Skip weekends
            if (current.day() !== 0 && current.day() !== 6) {
              const status = dayCount < actualPresentDays ? 'PRESENT' : 'ABSENT';
              
              await Attendance.create({
                employee_id: employee.id,
                date: current.format('YYYY-MM-DD'),
                check_in: status === 'PRESENT' ? '09:00:00' : null,
                check_out: status === 'PRESENT' ? '17:00:00' : null,
                status: status,
                work_hours: status === 'PRESENT' ? 8 : 0
              });
              
              dayCount++;
            }
            current.add(1, 'day');
          }
          
          // Generate payroll
          const payroll = await PayrollService.generatePayroll(
            employee.id,
            month,
            year,
            testUsers[0].id,
            { ip: '127.0.0.1', headers: { 'user-agent': 'test' } }
          );
          
          // Calculate expected values
          const basicSalary = parseFloat(salaryStructure.basic_salary);
          const allowances = salaryStructure.allowances || {};
          let totalAllowances = 0;
          Object.values(allowances).forEach(amount => {
            totalAllowances += parseFloat(amount) || 0;
          });
          
          const expectedGrossSalary = basicSalary + totalAllowances;
          const attendanceRatio = actualPresentDays / workingDays;
          const expectedProRatedGross = expectedGrossSalary * attendanceRatio;
          
          // Calculate expected deductions
          const deductions = salaryStructure.deductions || {};
          let expectedDeductions = 0;
          Object.entries(deductions).forEach(([key, value]) => {
            if (typeof value === 'string' && value.includes('%')) {
              const percentage = parseFloat(value.replace('%', ''));
              expectedDeductions += (expectedGrossSalary * percentage) / 100;
            } else {
              expectedDeductions += parseFloat(value) || 0;
            }
          });
          expectedDeductions *= attendanceRatio;
          
          const expectedNetSalary = expectedProRatedGross - expectedDeductions;
          
          // Assertions
          expect(payroll.working_days).toBe(workingDays);
          expect(payroll.present_days).toBe(actualPresentDays);
          expect(Math.abs(payroll.gross_salary - expectedProRatedGross)).toBeLessThan(0.01);
          expect(Math.abs(payroll.net_salary - expectedNetSalary)).toBeLessThan(0.01);
          
          // Verify attendance ratio is correctly applied
          if (workingDays > 0) {
            const calculatedRatio = payroll.present_days / payroll.working_days;
            expect(Math.abs(calculatedRatio - attendanceRatio)).toBeLessThan(0.01);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  /**
   * Property 23: Salary Structure Flexibility
   * Validates: Requirements 7.2
   * 
   * This property ensures that the payroll system can handle various salary structures
   * with different combinations of allowances and deductions (both fixed amounts and percentages).
   */
  test('Property 23: Salary Structure Flexibility', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 30000, max: 100000 }), // basic salary
        fc.record({
          transport: fc.integer({ min: 1000, max: 5000 }),
          meal: fc.integer({ min: 500, max: 2000 }),
          medical: fc.integer({ min: 2000, max: 8000 }),
          housing: fc.integer({ min: 5000, max: 15000 })
        }), // allowances
        fc.record({
          tax: fc.oneof(
            fc.constant('5%'),
            fc.constant('10%'),
            fc.constant('15%')
          ),
          insurance: fc.integer({ min: 500, max: 2000 }),
          provident_fund: fc.oneof(
            fc.constant('12%'),
            fc.integer({ min: 1000, max: 3000 })
          )
        }), // deductions
        fc.integer({ min: 0, max: testEmployees.length - 1 }), // employee index
        async (basicSalary, allowances, deductions, employeeIndex) => {
          const employee = testEmployees[employeeIndex];
          const month = 1;
          const year = 2024;
          
          // Create a new salary structure with the generated values
          const salaryData = {
            employee_id: employee.id,
            basic_salary: basicSalary,
            allowances: allowances,
            deductions: deductions,
            effective_from: '2024-01-01'
          };
          
          const salaryStructure = await SalaryStructure.create(salaryData);
          
          // Create full attendance for the month (to test salary structure, not attendance)
          const startDate = moment('2024-01-01').startOf('month');
          const endDate = moment(startDate).endOf('month');
          const workingDays = Payroll.calculateWorkingDays(startDate, endDate);
          
          const current = moment(startDate);
          let dayCount = 0;
          
          while (current.isSameOrBefore(endDate) && dayCount < workingDays) {
            if (current.day() !== 0 && current.day() !== 6) {
              await Attendance.create({
                employee_id: employee.id,
                date: current.format('YYYY-MM-DD'),
                check_in: '09:00:00',
                check_out: '17:00:00',
                status: 'PRESENT',
                work_hours: 8
              });
              dayCount++;
            }
            current.add(1, 'day');
          }
          
          // Generate payroll
          const payroll = await PayrollService.generatePayroll(
            employee.id,
            month,
            year,
            testUsers[0].id,
            { ip: '127.0.0.1', headers: { 'user-agent': 'test' } }
          );
          
          // Calculate expected gross salary
          let expectedGrossSalary = basicSalary;
          Object.values(allowances).forEach(amount => {
            expectedGrossSalary += parseFloat(amount) || 0;
          });
          
          // Calculate expected deductions
          let expectedDeductions = 0;
          Object.entries(deductions).forEach(([key, value]) => {
            if (typeof value === 'string' && value.includes('%')) {
              const percentage = parseFloat(value.replace('%', ''));
              expectedDeductions += (expectedGrossSalary * percentage) / 100;
            } else {
              expectedDeductions += parseFloat(value) || 0;
            }
          });
          
          const expectedNetSalary = expectedGrossSalary - expectedDeductions;
          
          // Assertions
          expect(payroll.basic_salary).toBe(basicSalary);
          expect(Math.abs(payroll.gross_salary - expectedGrossSalary)).toBeLessThan(0.01);
          expect(Math.abs(payroll.deductions - expectedDeductions)).toBeLessThan(0.01);
          expect(Math.abs(payroll.net_salary - expectedNetSalary)).toBeLessThan(0.01);
          
          // Verify that allowances are correctly calculated
          let expectedAllowancesTotal = 0;
          Object.values(allowances).forEach(amount => {
            expectedAllowancesTotal += parseFloat(amount) || 0;
          });
          expect(Math.abs(payroll.allowances - expectedAllowancesTotal)).toBeLessThan(0.01);
          
          // Verify salary structure flexibility - different structures should produce different results
          expect(payroll.gross_salary).toBeGreaterThan(payroll.basic_salary);
          expect(payroll.net_salary).toBeLessThan(payroll.gross_salary);
          
          // Clean up the created salary structure
          await pool.query('DELETE FROM salary_structures WHERE id = $1', [salaryStructure.id]);
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  /**
   * Additional Property: Payroll Generation Idempotency
   * Ensures that generating payroll for the same employee and period multiple times
   * should not create duplicate records.
   */
  test('Property: Payroll Generation Idempotency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 12 }), // month
        fc.integer({ min: 2023, max: 2024 }), // year
        fc.integer({ min: 0, max: testEmployees.length - 1 }), // employee index
        async (month, year, employeeIndex) => {
          const employee = testEmployees[employeeIndex];
          
          // Create some attendance data
          const startDate = moment(`${year}-${month}-01`).startOf('month');
          const endDate = moment(startDate).endOf('month');
          const workingDays = Payroll.calculateWorkingDays(startDate, endDate);
          
          const current = moment(startDate);
          let dayCount = 0;
          
          while (current.isSameOrBefore(endDate) && dayCount < Math.min(workingDays, 15)) {
            if (current.day() !== 0 && current.day() !== 6) {
              await Attendance.create({
                employee_id: employee.id,
                date: current.format('YYYY-MM-DD'),
                check_in: '09:00:00',
                check_out: '17:00:00',
                status: 'PRESENT',
                work_hours: 8
              });
              dayCount++;
            }
            current.add(1, 'day');
          }
          
          // Generate payroll first time
          const payroll1 = await PayrollService.generatePayroll(
            employee.id,
            month,
            year,
            testUsers[0].id,
            { ip: '127.0.0.1', headers: { 'user-agent': 'test' } }
          );
          
          // Attempt to generate payroll second time - should throw error
          await expect(
            PayrollService.generatePayroll(
              employee.id,
              month,
              year,
              testUsers[0].id,
              { ip: '127.0.0.1', headers: { 'user-agent': 'test' } }
            )
          ).rejects.toThrow('Payroll already exists for this period');
          
          // Verify only one payroll record exists
          const payrolls = await Payroll.findByEmployeeAndPeriod(employee.id, month, year);
          expect(payrolls).toBeTruthy();
          expect(payrolls.id).toBe(payroll1.id);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * Additional Property: Leave Integration with Payroll
   * Ensures that approved leaves are properly considered in payroll calculations.
   */
  test('Property: Leave Integration with Payroll', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // number of leave days
        fc.integer({ min: 0, max: testEmployees.length - 1 }), // employee index
        async (leaveDays, employeeIndex) => {
          const employee = testEmployees[employeeIndex];
          const month = 2;
          const year = 2024;
          
          // Create leave request
          const startDate = moment('2024-02-05');
          const endDate = moment(startDate).add(leaveDays - 1, 'days');
          
          const leaveData = {
            employee_id: employee.id,
            leave_type: 'SICK',
            start_date: startDate.format('YYYY-MM-DD'),
            end_date: endDate.format('YYYY-MM-DD'),
            reason: 'Property test leave',
            status: 'APPROVED'
          };
          
          const leave = await Leave.create(leaveData);
          
          // Create attendance for non-leave days
          const monthStart = moment('2024-02-01').startOf('month');
          const monthEnd = moment(monthStart).endOf('month');
          const workingDays = Payroll.calculateWorkingDays(monthStart, monthEnd);
          
          const current = moment(monthStart);
          let dayCount = 0;
          
          while (current.isSameOrBefore(monthEnd)) {
            if (current.day() !== 0 && current.day() !== 6) { // Skip weekends
              const isLeaveDay = current.isBetween(startDate, endDate, 'day', '[]');
              
              if (!isLeaveDay && dayCount < (workingDays - leaveDays)) {
                await Attendance.create({
                  employee_id: employee.id,
                  date: current.format('YYYY-MM-DD'),
                  check_in: '09:00:00',
                  check_out: '17:00:00',
                  status: 'PRESENT',
                  work_hours: 8
                });
                dayCount++;
              }
            }
            current.add(1, 'day');
          }
          
          // Generate payroll
          const payroll = await PayrollService.generatePayroll(
            employee.id,
            month,
            year,
            testUsers[0].id,
            { ip: '127.0.0.1', headers: { 'user-agent': 'test' } }
          );
          
          // Verify leave days are recorded in payroll
          expect(payroll.leave_days).toBeGreaterThanOrEqual(leaveDays);
          expect(payroll.present_days).toBeLessThan(payroll.working_days);
          
          // Verify salary is pro-rated based on attendance (excluding leave days)
          const attendanceRatio = payroll.present_days / payroll.working_days;
          expect(attendanceRatio).toBeLessThan(1);
          
          // Clean up
          await Leave.delete(leave.id);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});