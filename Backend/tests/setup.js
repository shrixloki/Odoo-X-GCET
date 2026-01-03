const pool = require('../src/config/database');

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.BCRYPT_ROUNDS = '4'; // Faster for tests
});

// Clean up after all tests
afterAll(async () => {
  await pool.end();
});

// Global test utilities
global.testUtils = {
  // Helper to create test user
  createTestUser: async () => {
    const User = require('../src/models/User');
    const testUser = {
      employee_id: `TEST${Date.now()}`,
      email: `test${Date.now()}@test.com`,
      password: 'testpass123',
      role: 'EMPLOYEE'
    };
    return await User.create(testUser);
  },

  // Helper to create test admin
  createTestAdmin: async () => {
    const User = require('../src/models/User');
    const testAdmin = {
      employee_id: `ADMIN${Date.now()}`,
      email: `admin${Date.now()}@test.com`,
      password: 'adminpass123',
      role: 'ADMIN'
    };
    return await User.create(testAdmin);
  },

  // Helper to clean up test data - proper order to handle foreign keys
  cleanupTestData: async () => {
    try {
      // Delete in proper order to handle foreign key constraints
      await pool.query('DELETE FROM audit_logs WHERE performed_by IN (SELECT id FROM users WHERE employee_id LIKE \'TEST%\' OR employee_id LIKE \'ADMIN%\')');
      await pool.query('DELETE FROM attendance WHERE employee_id IN (SELECT id FROM employees WHERE user_id IN (SELECT id FROM users WHERE employee_id LIKE \'TEST%\' OR employee_id LIKE \'ADMIN%\'))');
      await pool.query('DELETE FROM leave_requests WHERE employee_id IN (SELECT id FROM employees WHERE user_id IN (SELECT id FROM users WHERE employee_id LIKE \'TEST%\' OR employee_id LIKE \'ADMIN%\'))');
      await pool.query('DELETE FROM documents WHERE employee_id IN (SELECT id FROM employees WHERE user_id IN (SELECT id FROM users WHERE employee_id LIKE \'TEST%\' OR employee_id LIKE \'ADMIN%\'))');
      await pool.query('DELETE FROM payroll WHERE employee_id IN (SELECT id FROM employees WHERE user_id IN (SELECT id FROM users WHERE employee_id LIKE \'TEST%\' OR employee_id LIKE \'ADMIN%\'))');
      await pool.query('DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE employee_id LIKE \'TEST%\' OR employee_id LIKE \'ADMIN%\')');
      await pool.query('DELETE FROM employees WHERE user_id IN (SELECT id FROM users WHERE employee_id LIKE \'TEST%\' OR employee_id LIKE \'ADMIN%\')');
      await pool.query('DELETE FROM users WHERE employee_id LIKE \'TEST%\' OR employee_id LIKE \'ADMIN%\'');
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn('Test cleanup warning:', error.message);
    }
  }
};