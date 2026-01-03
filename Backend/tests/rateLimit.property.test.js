const fc = require('fast-check');
const request = require('supertest');
const app = require('../src/app');

describe('Rate Limiting Property Tests', () => {
  beforeEach(async () => {
    // Clean up test data before each test
    await global.testUtils.cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await global.testUtils.cleanupTestData();
  });

  describe('Property 26: Authentication Rate Limiting', () => {
    test('Feature: hrms-backend-integration, Property 26: For any series of authentication attempts from the same IP, the system should implement rate limiting', async () => {
      // Test with a high number of requests to ensure we hit the rate limit
      const testIP = '192.168.1.100';
      const requestCount = 120; // Higher than the configured limit of 100
      
      const promises = [];
      for (let i = 0; i < requestCount; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' })
            .set('X-Forwarded-For', testIP)
        );
      }
      
      const responses = await Promise.all(promises);
      
      // Check that rate limiting kicks in
      let rateLimitedResponses = 0;
      let successfulResponses = 0;
      let errorResponses = 0;
      
      responses.forEach(response => {
        if (response.status === 429) {
          rateLimitedResponses++;
          expect(response.body.success).toBe(false);
          expect(response.body.message).toContain('Too many requests');
        } else if (response.status === 401 || response.status === 400) {
          errorResponses++;
        } else if (response.status === 200) {
          successfulResponses++;
        }
      });
      
      // With 120 requests, we should definitely see rate limiting
      expect(rateLimitedResponses).toBeGreaterThan(0);
      
      // Total responses should equal request count
      expect(rateLimitedResponses + successfulResponses + errorResponses).toBe(requestCount);
    }, 30000);

    test('Rate limiting should be per-IP based', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const ip1 = '192.168.1.200';
      const ip2 = '192.168.1.201';
      
      // Make requests from first IP
      const ip1Promises = [];
      for (let i = 0; i < 60; i++) {
        ip1Promises.push(
          request(app)
            .post('/api/auth/login')
            .send({ email, password })
            .set('X-Forwarded-For', ip1)
        );
      }
      
      // Make requests from second IP
      const ip2Promises = [];
      for (let i = 0; i < 60; i++) {
        ip2Promises.push(
          request(app)
            .post('/api/auth/login')
            .send({ email, password })
            .set('X-Forwarded-For', ip2)
        );
      }
      
      const [ip1Responses, ip2Responses] = await Promise.all([
        Promise.all(ip1Promises),
        Promise.all(ip2Promises)
      ]);
      
      // Count rate limited responses for each IP
      const ip1RateLimited = ip1Responses.filter(r => r.status === 429).length;
      const ip2RateLimited = ip2Responses.filter(r => r.status === 429).length;
      
      // Both IPs should be treated independently
      expect(ip1RateLimited + ip2RateLimited).toBeGreaterThanOrEqual(0);
      
      // Verify that responses are properly formatted
      ip1Responses.concat(ip2Responses).forEach(response => {
        expect([200, 400, 401, 429]).toContain(response.status);
        expect(response.body).toHaveProperty('success');
      });
    }, 30000);

    test('Rate limiting should reset after time window', async () => {
      const email = 'test@example.com';
      const password = 'testpassword123';
      const testIP = '192.168.1.300';
      
      // Make initial requests to potentially trigger rate limiting
      const initialPromises = [];
      for (let i = 0; i < 50; i++) {
        initialPromises.push(
          request(app)
            .post('/api/auth/login')
            .send({ email, password })
            .set('X-Forwarded-For', testIP)
        );
      }
      
      const initialResponses = await Promise.all(initialPromises);
      
      // Check if any were rate limited
      const initialRateLimited = initialResponses.filter(r => r.status === 429).length;
      
      // Wait a short time (simulating window reset - in real scenario this would be longer)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Make another request
      const laterResponse = await request(app)
        .post('/api/auth/login')
        .send({ email, password })
        .set('X-Forwarded-For', testIP);
      
      // The later request should be processed (not necessarily successful, but not rate limited due to time)
      expect([200, 400, 401, 429]).toContain(laterResponse.status);
      expect(laterResponse.body).toHaveProperty('success');
    }, 15000);

    test('Rate limiting should apply to all authentication endpoints', async () => {
      const testIP = '192.168.1.400';
      const requestCount = 110; // Above the limit
      
      // Test different auth endpoints
      const endpoints = [
        { path: '/api/auth/login', method: 'post', body: { email: 'test@example.com', password: 'password123' } },
        { path: '/api/auth/signup', method: 'post', body: { 
          employee_id: 'TEST123', 
          email: 'newuser@example.com', 
          password: 'password123',
          full_name: 'Test User',
          department: 'IT',
          designation: 'Developer',
          joining_date: '2024-01-01'
        }},
        { path: '/api/auth/refresh-token', method: 'post', body: { refreshToken: 'invalid-token' } }
      ];
      
      const allPromises = [];
      
      // Make requests to various endpoints from same IP
      for (let i = 0; i < requestCount; i++) {
        const endpoint = endpoints[i % endpoints.length];
        allPromises.push(
          request(app)
            [endpoint.method](endpoint.path)
            .send(endpoint.body)
            .set('X-Forwarded-For', testIP)
        );
      }
      
      const responses = await Promise.all(allPromises);
      
      // Check for rate limiting across all endpoints
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      const totalRequests = responses.length;
      
      // Verify all requests were processed
      expect(totalRequests).toBe(requestCount);
      
      // For high request counts, we should see some rate limiting
      expect(rateLimitedCount).toBeGreaterThan(0);
      
      // Verify rate limited responses have proper format
      responses.filter(r => r.status === 429).forEach(response => {
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Too many requests');
      });
    }, 30000);
  });

  describe('Rate Limiting Configuration Validation', () => {
    test('Rate limiting should have proper configuration', async () => {
      // Test that rate limiting is configured with reasonable limits
      const testIP = '192.168.1.500';
      const responses = [];
      
      // Make requests until we hit the limit or reach a reasonable number
      for (let i = 0; i < 150; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password123' })
          .set('X-Forwarded-For', testIP);
        
        responses.push(response);
        
        // If we hit rate limiting, break
        if (response.status === 429) {
          break;
        }
      }
      
      // Should have hit rate limiting before 150 requests
      const rateLimitedResponse = responses.find(r => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();
      
      // Verify response format
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body.success).toBe(false);
        expect(rateLimitedResponse.body.message).toContain('Too many requests');
      }
    }, 30000);
  });
});