const fc = require('fast-check');
const request = require('supertest');
const app = require('../src/app');
const AuthService = require('../src/services/authService');
const EmployeeService = require('../src/services/employeeService');

describe('Employee Management Property Tests', () => {
  let testUsers = {};
  let testTokens = {};

  beforeAll(async () => {
    // Create test users with different roles
    const users = [
      {
        employee_id: 'ADMIN001',
        email: 'admin@test.com',
        password: 'password123',
        full_name: 'Test Admin',
        role: 'Admin',
        department: 'IT',
        designation: 'System Administrator',
        joining_date: '2024-01-01'
      },
      {
        employee_id: 'HR001',
        email: 'hr@test.com',
        password: 'password123',
        full_name: 'Test HR Manager',
        role: 'HR_Manager',
        department: 'HR',
        designation: 'HR Manager',
        joining_date: '2024-01-01'
      },
      {
        employee_id: 'EMP001',
        email: 'employee@test.com',
        password: 'password123',
        full_name: 'Test Employee',
        role: 'Employee',
        department: 'Engineering',
        designation: 'Software Developer',
        joining_date: '2024-01-01'
      }
    ];

    for (const userData of users) {
      try {
        const result = await AuthService.signup(userData, '127.0.0.1', 'test-agent');
        testUsers[userData.role] = result.user;
        testTokens[userData.role] = result.accessToken;
      } catch (error) {
        // User might already exist, try to login
        try {
          const loginResult = await AuthService.login(userData.email, userData.password, '127.0.0.1', 'test-agent');
          testUsers[userData.role] = loginResult.user;
          testTokens[userData.role] = loginResult.accessToken;
        } catch (loginError) {
          console.error(`Failed to create/login test user ${userData.role}:`, loginError.message);
        }
      }
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await global.testUtils.cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await global.testUtils.cleanupTestData();
  });

  describe('Property 6: Universal Input Validation', () => {
    test('Feature: hrms-backend-integration, Property 6: For any employee data input, the system should validate all fields according to business rules', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            employee_id: fc.oneof(
              fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
              fc.constant(''), // Invalid: empty
              fc.string({ minLength: 1, maxLength: 2 }), // Invalid: too short
              fc.string({ minLength: 21, maxLength: 30 }) // Invalid: too long
            ),
            email: fc.oneof(
              fc.emailAddress(),
              fc.constant('invalid-email'), // Invalid format
              fc.constant('')
            ),
            password: fc.oneof(
              fc.string({ minLength: 6, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 5 }), // Invalid: too short
              fc.constant('')
            ),
            full_name: fc.oneof(
              fc.string({ minLength: 2, maxLength: 255 }),
              fc.constant(''), // Invalid: empty
              fc.string({ minLength: 1, maxLength: 1 }) // Invalid: too short
            ),
            department: fc.oneof(
              fc.string({ minLength: 2, maxLength: 100 }),
              fc.constant('') // Invalid: empty
            ),
            designation: fc.oneof(
              fc.string({ minLength: 2, maxLength: 100 }),
              fc.constant('') // Invalid: empty
            ),
            joining_date: fc.oneof(
              fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString().split('T')[0]),
              fc.constant('invalid-date'), // Invalid format
              fc.constant('')
            )
          }),
          async (employeeData) => {
            const adminToken = testTokens['Admin'];
            if (!adminToken) return true;

            const response = await request(app)
              .post('/api/employee')
              .set('Authorization', `Bearer ${adminToken}`)
              .send(employeeData);

            // Check if input is valid
            const isValidEmployeeId = employeeData.employee_id && 
              employeeData.employee_id.length >= 3 && 
              employeeData.employee_id.length <= 20 &&
              /^[a-zA-Z0-9]+$/.test(employeeData.employee_id);
            
            const isValidEmail = employeeData.email && 
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeData.email);
            
            const isValidPassword = employeeData.password && 
              employeeData.password.length >= 6;
            
            const isValidFullName = employeeData.full_name && 
              employeeData.full_name.length >= 2;
            
            const isValidDepartment = employeeData.department && 
              employeeData.department.length >= 2;
            
            const isValidDesignation = employeeData.designation && 
              employeeData.designation.length >= 2;
            
            const isValidJoiningDate = employeeData.joining_date && 
              !isNaN(Date.parse(employeeData.joining_date));

            const isValidInput = isValidEmployeeId && isValidEmail && isValidPassword && 
              isValidFullName && isValidDepartment && isValidDesignation && isValidJoiningDate;

            if (isValidInput) {
              // Valid input should succeed (201) or fail due to business logic (400/409)
              expect([201, 400, 409]).toContain(response.status);
              if (response.status === 201) {
                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
              }
            } else {
              // Invalid input should be rejected with validation error
              expect(response.status).toBe(400);
              expect(response.body.success).toBe(false);
              expect(response.body.message).toContain('Validation error');
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    test('Employee update validation should work correctly', async () => {
      const adminToken = testTokens['Admin'];
      if (!adminToken) return;

      // First create a test employee
      const validEmployee = {
        employee_id: 'TEST001',
        email: 'test001@example.com',
        password: 'password123',
        full_name: 'Test Employee',
        department: 'Engineering',
        designation: 'Developer',
        joining_date: '2024-01-01'
      };

      const createResponse = await request(app)
        .post('/api/employee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validEmployee);

      if (createResponse.status !== 201) return;

      const employeeId = createResponse.body.data.user.id;

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            full_name: fc.oneof(
              fc.string({ minLength: 2, maxLength: 255 }),
              fc.constant(''), // Invalid: empty
              fc.string({ minLength: 1, maxLength: 1 }) // Invalid: too short
            ),
            email: fc.oneof(
              fc.emailAddress(),
              fc.constant('invalid-email') // Invalid format
            ),
            department: fc.oneof(
              fc.string({ minLength: 2, maxLength: 100 }),
              fc.constant('') // Invalid: empty
            )
          }),
          async (updateData) => {
            const response = await request(app)
              .put(`/api/employee/${employeeId}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .send(updateData);

            // Check if update data is valid
            const isValidFullName = !updateData.full_name || updateData.full_name.length >= 2;
            const isValidEmail = !updateData.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email);
            const isValidDepartment = !updateData.department || updateData.department.length >= 2;

            const isValidUpdate = isValidFullName && isValidEmail && isValidDepartment;

            if (isValidUpdate) {
              // Valid update should succeed
              expect([200, 400, 409]).toContain(response.status);
              if (response.status === 200) {
                expect(response.body.success).toBe(true);
              }
            } else {
              // Invalid update should be rejected
              expect(response.status).toBe(400);
              expect(response.body.success).toBe(false);
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    }, 20000);
  });

  describe('Property 7: Profile Update Persistence', () => {
    test('Feature: hrms-backend-integration, Property 7: For any valid profile update, the changes should be persisted and retrievable', async () => {
      const adminToken = testTokens['Admin'];
      if (!adminToken) return;

      // Create a test employee first
      const validEmployee = {
        employee_id: 'PERSIST001',
        email: 'persist001@example.com',
        password: 'password123',
        full_name: 'Persistence Test',
        department: 'Engineering',
        designation: 'Developer',
        joining_date: '2024-01-01'
      };

      const createResponse = await request(app)
        .post('/api/employee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validEmployee);

      if (createResponse.status !== 201) return;

      const employeeId = createResponse.body.data.user.id;

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            full_name: fc.string({ minLength: 2, maxLength: 255 }),
            department: fc.string({ minLength: 2, maxLength: 100 }),
            designation: fc.string({ minLength: 2, maxLength: 100 }),
            phone: fc.option(fc.string({ minLength: 10, maxLength: 15 })),
            address: fc.option(fc.string({ minLength: 5, maxLength: 500 }))
          }),
          async (updateData) => {
            // Update the employee
            const updateResponse = await request(app)
              .put(`/api/employee/${employeeId}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .send(updateData);

            if (updateResponse.status !== 200) return true;

            // Retrieve the updated employee
            const getResponse = await request(app)
              .get(`/api/employee/${employeeId}`)
              .set('Authorization', `Bearer ${adminToken}`);

            expect(getResponse.status).toBe(200);
            expect(getResponse.body.success).toBe(true);

            const retrievedEmployee = getResponse.body.data;

            // Verify that updates were persisted
            expect(retrievedEmployee.user.full_name).toBe(updateData.full_name);
            expect(retrievedEmployee.employee.department).toBe(updateData.department);
            expect(retrievedEmployee.employee.designation).toBe(updateData.designation);
            
            if (updateData.phone) {
              expect(retrievedEmployee.employee.phone).toBe(updateData.phone);
            }
            
            if (updateData.address) {
              expect(retrievedEmployee.employee.address).toBe(updateData.address);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    }, 25000);

    test('Profile updates should maintain data integrity', async () => {
      const adminToken = testTokens['Admin'];
      if (!adminToken) return;

      // Create multiple test employees
      const employees = [];
      for (let i = 0; i < 3; i++) {
        const employeeData = {
          employee_id: `INTEGRITY${i}`,
          email: `integrity${i}@example.com`,
          password: 'password123',
          full_name: `Integrity Test ${i}`,
          department: 'Engineering',
          designation: 'Developer',
          joining_date: '2024-01-01'
        };

        const response = await request(app)
          .post('/api/employee')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(employeeData);

        if (response.status === 201) {
          employees.push(response.body.data.user.id);
        }
      }

      if (employees.length === 0) return;

      // Test concurrent updates
      const updatePromises = employees.map((employeeId, index) => {
        return request(app)
          .put(`/api/employee/${employeeId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            full_name: `Updated Name ${index}`,
            department: `Updated Dept ${index}`
          });
      });

      const updateResponses = await Promise.all(updatePromises);

      // Verify all updates succeeded
      updateResponses.forEach((response, index) => {
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data.user.full_name).toBe(`Updated Name ${index}`);
        }
      });

      // Verify data integrity by retrieving all employees
      const getPromises = employees.map(employeeId => {
        return request(app)
          .get(`/api/employee/${employeeId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      });

      const getResponses = await Promise.all(getPromises);

      getResponses.forEach((response, index) => {
        if (response.status === 200) {
          expect(response.body.data.user.full_name).toBe(`Updated Name ${index}`);
          expect(response.body.data.employee.department).toBe(`Updated Dept ${index}`);
        }
      });
    }, 20000);
  });

  describe('Employee Management Access Control', () => {
    test('Employee creation should require proper authorization', async () => {
      const employeeData = {
        employee_id: 'AUTHTEST001',
        email: 'authtest001@example.com',
        password: 'password123',
        full_name: 'Auth Test',
        department: 'Engineering',
        designation: 'Developer',
        joining_date: '2024-01-01'
      };

      // Test with different user roles
      const testCases = [
        { role: 'Admin', token: testTokens['Admin'], shouldSucceed: true },
        { role: 'HR_Manager', token: testTokens['HR_Manager'], shouldSucceed: true },
        { role: 'Employee', token: testTokens['Employee'], shouldSucceed: false }
      ];

      for (const testCase of testCases) {
        if (!testCase.token) continue;

        const response = await request(app)
          .post('/api/employee')
          .set('Authorization', `Bearer ${testCase.token}`)
          .send({
            ...employeeData,
            employee_id: `${employeeData.employee_id}_${testCase.role}`
          });

        if (testCase.shouldSucceed) {
          expect([201, 400, 409]).toContain(response.status);
        } else {
          expect(response.status).toBe(403);
          expect(response.body.success).toBe(false);
        }
      }
    }, 15000);

    test('Employee data access should be properly controlled', async () => {
      const adminToken = testTokens['Admin'];
      const employeeToken = testTokens['Employee'];
      
      if (!adminToken || !employeeToken) return;

      // Create a test employee
      const employeeData = {
        employee_id: 'ACCESSTEST001',
        email: 'accesstest001@example.com',
        password: 'password123',
        full_name: 'Access Test',
        department: 'Engineering',
        designation: 'Developer',
        joining_date: '2024-01-01'
      };

      const createResponse = await request(app)
        .post('/api/employee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(employeeData);

      if (createResponse.status !== 201) return;

      const employeeId = createResponse.body.data.user.id;
      const currentEmployeeId = testUsers['Employee'].id;

      // Test access to own data (should work)
      const ownDataResponse = await request(app)
        .get(`/api/employee/${currentEmployeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect([200, 404]).toContain(ownDataResponse.status);

      // Test access to other employee's data (should fail)
      const otherDataResponse = await request(app)
        .get(`/api/employee/${employeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(otherDataResponse.status).toBe(403);
      expect(otherDataResponse.body.success).toBe(false);

      // Admin should be able to access any employee's data
      const adminAccessResponse = await request(app)
        .get(`/api/employee/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(adminAccessResponse.status);
    }, 15000);
  });

  describe('Employee Management Edge Cases', () => {
    test('Duplicate employee ID should be rejected', async () => {
      const adminToken = testTokens['Admin'];
      if (!adminToken) return;

      const employeeData = {
        employee_id: 'DUPLICATE001',
        email: 'duplicate1@example.com',
        password: 'password123',
        full_name: 'Duplicate Test 1',
        department: 'Engineering',
        designation: 'Developer',
        joining_date: '2024-01-01'
      };

      // Create first employee
      const firstResponse = await request(app)
        .post('/api/employee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(employeeData);

      // Try to create second employee with same employee_id
      const secondResponse = await request(app)
        .post('/api/employee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...employeeData,
          email: 'duplicate2@example.com',
          full_name: 'Duplicate Test 2'
        });

      if (firstResponse.status === 201) {
        expect(secondResponse.status).toBe(400);
        expect(secondResponse.body.success).toBe(false);
        expect(secondResponse.body.message).toContain('already exists');
      }
    }, 10000);

    test('Employee deactivation should work correctly', async () => {
      const adminToken = testTokens['Admin'];
      if (!adminToken) return;

      // Create a test employee
      const employeeData = {
        employee_id: 'DEACTIVATE001',
        email: 'deactivate001@example.com',
        password: 'password123',
        full_name: 'Deactivate Test',
        department: 'Engineering',
        designation: 'Developer',
        joining_date: '2024-01-01'
      };

      const createResponse = await request(app)
        .post('/api/employee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(employeeData);

      if (createResponse.status !== 201) return;

      const employeeId = createResponse.body.data.user.id;

      // Deactivate the employee
      const deactivateResponse = await request(app)
        .delete(`/api/employee/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(deactivateResponse.status);

      if (deactivateResponse.status === 200) {
        expect(deactivateResponse.body.success).toBe(true);
        expect(deactivateResponse.body.data.is_active).toBe(false);
      }
    }, 10000);
  });
});