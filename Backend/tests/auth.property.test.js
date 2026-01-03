const fc = require('fast-check');
const AuthService = require('../src/services/authService');
const User = require('../src/models/User');
const jwt = require('jsonwebtoken');

let testCounter = 0;

describe('Authentication Property Tests', () => {
  beforeEach(async () => {
    // Clean up test data before each test
    await global.testUtils.cleanupTestData();
    testCounter = 0;
  });

  afterEach(async () => {
    // Clean up test data after each test
    await global.testUtils.cleanupTestData();
  });

  describe('Property 1: Valid Authentication Token Generation', () => {
    test('Feature: hrms-backend-integration, Property 1: For any valid user credentials, the authentication service should generate properly formatted JWT access and refresh tokens with correct expiration times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            password: fc.string({ minLength: 8, maxLength: 20 }),
            full_name: fc.string({ minLength: 3, maxLength: 50 }),
            department: fc.constantFrom('IT', 'HR', 'Finance', 'Operations'),
            designation: fc.string({ minLength: 3, maxLength: 30 })
          }),
          async (userData) => {
            testCounter++;
            const uniqueId = `TEST${Date.now()}${testCounter}`;
            const uniqueEmail = `test${Date.now()}${testCounter}@example.com`;
            
            // Create a user first
            const signupResult = await AuthService.signup({
              ...userData,
              employee_id: uniqueId,
              email: uniqueEmail,
              joining_date: new Date().toISOString().split('T')[0]
            });
            
            // Test login with valid credentials
            const loginResult = await AuthService.login(uniqueEmail, userData.password);
            
            // Verify tokens exist and are properly formatted
            expect(loginResult.accessToken).toBeDefined();
            expect(loginResult.refreshToken).toBeDefined();
            expect(typeof loginResult.accessToken).toBe('string');
            expect(typeof loginResult.refreshToken).toBe('string');
            
            // Verify tokens can be decoded
            const accessDecoded = jwt.decode(loginResult.accessToken);
            const refreshDecoded = jwt.decode(loginResult.refreshToken);
            
            expect(accessDecoded).toBeDefined();
            expect(refreshDecoded).toBeDefined();
            expect(accessDecoded.userId).toBe(loginResult.user.id);
            expect(refreshDecoded.userId).toBe(loginResult.user.id);
            expect(accessDecoded.email).toBe(uniqueEmail);
            expect(refreshDecoded.email).toBe(uniqueEmail);
            
            // Verify expiration times are set
            expect(accessDecoded.exp).toBeDefined();
            expect(refreshDecoded.exp).toBeDefined();
            expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp); // Refresh token should expire later
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 2: Invalid Authentication Rejection', () => {
    test('Feature: hrms-backend-integration, Property 2: For any invalid credentials (wrong password, non-existent email, malformed input), the authentication service should reject the request with appropriate error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            password: fc.string({ minLength: 8, maxLength: 20 }),
            full_name: fc.string({ minLength: 3, maxLength: 50 }),
            wrongPassword: fc.string({ minLength: 8, maxLength: 20 }).filter(p => p !== 'password')
          }),
          async (userData) => {
            testCounter++;
            const uniqueId = `TEST${Date.now()}${testCounter}`;
            const uniqueEmail = `test${Date.now()}${testCounter}@example.com`;
            const nonExistentEmail = `nonexistent${Date.now()}${testCounter}@example.com`;
            
            // Create a user first
            await AuthService.signup({
              ...userData,
              employee_id: uniqueId,
              email: uniqueEmail,
              department: 'IT',
              designation: 'Developer',
              joining_date: new Date().toISOString().split('T')[0]
            });
            
            // Test 1: Wrong password should fail
            try {
              await AuthService.login(uniqueEmail, userData.wrongPassword);
              expect(true).toBe(false); // Should not reach here
            } catch (error) {
              expect(error.message).toBe('Invalid credentials');
            }
            
            // Test 2: Non-existent email should fail
            try {
              await AuthService.login(nonExistentEmail, userData.password);
              expect(true).toBe(false); // Should not reach here
            } catch (error) {
              expect(error.message).toBe('Invalid credentials');
            }
            
            // Test 3: Empty password should fail
            try {
              await AuthService.login(uniqueEmail, '');
              expect(true).toBe(false); // Should not reach here
            } catch (error) {
              expect(error.message).toBe('Invalid credentials');
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 4: Password Security', () => {
    test('Feature: hrms-backend-integration, Property 4: For any password input, the stored version should be bcrypt hashed and never stored in plain text', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            password: fc.string({ minLength: 8, maxLength: 20 }),
            full_name: fc.string({ minLength: 3, maxLength: 50 })
          }),
          async (userData) => {
            testCounter++;
            const uniqueId = `TEST${Date.now()}${testCounter}`;
            const uniqueEmail = `test${Date.now()}${testCounter}@example.com`;
            
            // Create a user
            const signupResult = await AuthService.signup({
              ...userData,
              employee_id: uniqueId,
              email: uniqueEmail,
              department: 'IT',
              designation: 'Developer',
              joining_date: new Date().toISOString().split('T')[0]
            });
            
            // Get user from database
            const user = await User.findByEmail(uniqueEmail);
            
            // Verify password is hashed
            expect(user.password_hash).toBeDefined();
            expect(user.password_hash).not.toBe(userData.password); // Should not be plain text
            expect(user.password_hash.length).toBeGreaterThan(50); // bcrypt hashes are long
            expect(user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')).toBe(true); // bcrypt format
            
            // Verify password can be validated
            const isValid = await User.validatePassword(userData.password, user.password_hash);
            expect(isValid).toBe(true);
            
            // Verify wrong password fails validation
            const isInvalid = await User.validatePassword('wrongpassword', user.password_hash);
            expect(isInvalid).toBe(false);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Token Lifecycle Management', () => {
    test('Feature: hrms-backend-integration, Property 3: For any expired JWT token, the system should require re-authentication using valid refresh tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            password: fc.string({ minLength: 8, maxLength: 20 }),
            full_name: fc.string({ minLength: 3, maxLength: 50 })
          }),
          async (userData) => {
            testCounter++;
            const uniqueId = `TEST${Date.now()}${testCounter}`;
            const uniqueEmail = `test${Date.now()}${testCounter}@example.com`;
            
            // Create and login user
            await AuthService.signup({
              ...userData,
              employee_id: uniqueId,
              email: uniqueEmail,
              department: 'IT',
              designation: 'Developer',
              joining_date: new Date().toISOString().split('T')[0]
            });
            
            const loginResult = await AuthService.login(uniqueEmail, userData.password);
            
            // Test refresh token functionality
            const refreshResult = await AuthService.refreshToken(loginResult.refreshToken);
            
            expect(refreshResult.accessToken).toBeDefined();
            expect(refreshResult.refreshToken).toBeDefined();
            expect(refreshResult.user.id).toBe(loginResult.user.id);
            
            // New tokens should be different from original
            expect(refreshResult.accessToken).not.toBe(loginResult.accessToken);
            expect(refreshResult.refreshToken).not.toBe(loginResult.refreshToken);
            
            // Test invalid refresh token
            try {
              await AuthService.refreshToken('invalid-token');
              expect(true).toBe(false); // Should not reach here
            } catch (error) {
              expect(error.message).toBe('Invalid refresh token');
            }
          }
        ),
        { numRuns: 3 }
      );
    });
  });

  describe('Account Status Validation', () => {
    test('Deactivated accounts should not be able to login', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            password: fc.string({ minLength: 8, maxLength: 20 }),
            full_name: fc.string({ minLength: 3, maxLength: 50 })
          }),
          async (userData) => {
            testCounter++;
            const uniqueId = `TEST${Date.now()}${testCounter}`;
            const uniqueEmail = `test${Date.now()}${testCounter}@example.com`;
            
            // Create user
            const signupResult = await AuthService.signup({
              ...userData,
              employee_id: uniqueId,
              email: uniqueEmail,
              department: 'IT',
              designation: 'Developer',
              joining_date: new Date().toISOString().split('T')[0]
            });
            
            // Deactivate user
            await User.deactivate(signupResult.user.id);
            
            // Try to login with deactivated account
            try {
              await AuthService.login(uniqueEmail, userData.password);
              expect(true).toBe(false); // Should not reach here
            } catch (error) {
              expect(error.message).toBe('Account is deactivated');
            }
          }
        ),
        { numRuns: 3 }
      );
    });
  });
});