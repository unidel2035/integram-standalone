#!/usr/bin/env node

/**
 * Test script for IntegramAuthService
 * Tests real authentication against Integram API
 */

const { IntegramAuthService } = require('./src/services/IntegramAuthService.cjs');

async function testAuthService() {
  console.log('🧪 Testing IntegramAuthService\n');

  const authService = new IntegramAuthService();

  try {
    // Test 1: Authenticate with valid credentials
    console.log('📝 Test 1: Authenticate with valid credentials (d/d at a2025)');
    const authResult = await authService.authenticate('d', 'd', 'a2025');

    console.log('Auth result:', JSON.stringify(authResult, null, 2));

    if (!authResult.success) {
      console.error('❌ Authentication failed!');
      process.exit(1);
    }

    console.log('✅ Test 1 passed: Authentication successful\n');

    // Test 2: Verify session
    console.log('📝 Test 2: Verify session');
    const sessionCheck = await authService.verifySession(authResult.session);

    console.log('Session check:', JSON.stringify(sessionCheck, null, 2));

    if (!sessionCheck.valid) {
      console.error('❌ Session verification failed!');
      process.exit(1);
    }

    console.log('✅ Test 2 passed: Session verified\n');

    // Test 3: Get session data
    console.log('📝 Test 3: Get session data');
    const sessionData = authService.getSession(authResult.session);

    console.log('Session data:', JSON.stringify(sessionData, null, 2));

    if (!sessionData) {
      console.error('❌ Session data not found!');
      process.exit(1);
    }

    console.log('✅ Test 3 passed: Session data retrieved\n');

    // Test 4: Invalidate session
    console.log('📝 Test 4: Invalidate session');
    const logoutResult = await authService.invalidateSession(authResult.session);

    if (!logoutResult) {
      console.error('❌ Session invalidation failed!');
      process.exit(1);
    }

    console.log('✅ Test 4 passed: Session invalidated\n');

    // Test 5: Verify invalidated session
    console.log('📝 Test 5: Verify invalidated session (should fail)');
    const expiredSessionCheck = await authService.verifySession(authResult.session);

    console.log('Expired session check:', JSON.stringify(expiredSessionCheck, null, 2));

    if (expiredSessionCheck.valid) {
      console.error('❌ Invalidated session is still valid!');
      process.exit(1);
    }

    console.log('✅ Test 5 passed: Invalidated session correctly rejected\n');

    // Test 6: Invalid credentials
    console.log('📝 Test 6: Authenticate with invalid credentials');
    const invalidAuthResult = await authService.authenticate('invalid', 'invalid', 'a2025');

    console.log('Invalid auth result:', JSON.stringify(invalidAuthResult, null, 2));

    if (invalidAuthResult.success) {
      console.error('❌ Invalid credentials were accepted!');
      process.exit(1);
    }

    console.log('✅ Test 6 passed: Invalid credentials rejected\n');

    console.log('🎉 All tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAuthService();
