#!/usr/bin/env node

/**
 * Complete API v2 Integration Test
 * Tests real authentication and data retrieval
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api/v2';
const TEST_USER = {
  login: 'd',
  password: 'd',
  database: 'a2025'
};

async function testAPIv2() {
  console.log('🧪 Complete API v2 Integration Test\n');

  try {
    // Test 1: Server health check
    console.log('📝 Test 1: Check server health');
    try {
      const healthResponse = await axios.get(API_BASE_URL, {  // Changed from /info to root
        timeout: 5000
      });
      console.log('✅ Server is running:');
      console.log(JSON.stringify(healthResponse.data, null, 2));
    } catch (error) {
      console.error('❌ Server is not responding. Please start the server first:');
      console.error('   cd backend/monolith && node src/server-api-v2.js');
      console.error('Error:', error.message);
      process.exit(1);
    }

    console.log('\n');

    // Test 2: Authentication
    console.log('📝 Test 2: Authenticate user');
    const authResponse = await axios.post(
      `${API_BASE_URL}/auth`,
      {
        data: {
          type: 'auth',
          attributes: TEST_USER
        }
      },
      {
        headers: {
          'Content-Type': 'application/vnd.api+json'
        }
      }
    );

    console.log('Auth response:', JSON.stringify(authResponse.data, null, 2));

    if (!authResponse.data || !authResponse.data.data) {
      console.error('❌ Invalid auth response format');
      process.exit(1);
    }

    const session = authResponse.data.data.attributes.session;
    const token = authResponse.data.data.attributes.token;

    console.log('✅ Authenticated successfully');
    console.log(`  - Session: ${session}`);
    console.log(`  - Token: ${token.substring(0, 30)}...`);

    console.log('\n');

    // Test 3: Verify session
    console.log('📝 Test 3: Verify session');
    const verifyResponse = await axios.get(
      `${API_BASE_URL}/auth/verify`,
      {
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/vnd.api+json'
        }
      }
    );

    console.log('Verify response:', JSON.stringify(verifyResponse.data, null, 2));
    console.log('✅ Session verified successfully');

    console.log('\n');

    // Test 4: Get dictionary
    console.log('📝 Test 4: Get dictionary (list of types)');
    const dictResponse = await axios.get(
      `${API_BASE_URL}/integram/databases/${TEST_USER.database}/types`,
      {
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/vnd.api+json'
        }
      }
    );

    console.log('Dictionary response:');
    console.log(`  - Status: ${dictResponse.status}`);
    console.log(`  - Types count: ${dictResponse.data.data?.length || 0}`);

    if (dictResponse.data.data && dictResponse.data.data.length > 0) {
      console.log('\nFirst 3 types:');
      dictResponse.data.data.slice(0, 3).forEach(type => {
        console.log(`  - ID: ${type.id}, Name: ${type.attributes.name}`);
      });
    }

    console.log('✅ Dictionary retrieved successfully');

    console.log('\n');

    // Test 5: Get type metadata
    if (dictResponse.data.data && dictResponse.data.data.length > 0) {
      const firstTypeId = dictResponse.data.data[0].id;

      console.log(`📝 Test 5: Get type metadata for type ${firstTypeId}`);
      const metaResponse = await axios.get(
        `${API_BASE_URL}/integram/databases/${TEST_USER.database}/types/${firstTypeId}/metadata`,
        {
          headers: {
            'Authorization': `Bearer ${session}`,
            'Content-Type': 'application/vnd.api+json'
          }
        }
      );

      console.log('Type metadata:');
      console.log(`  - ID: ${metaResponse.data.data.id}`);
      console.log(`  - Name: ${metaResponse.data.data.attributes.name}`);
      console.log(`  - Requisites: ${metaResponse.data.data.attributes.requisites?.length || 0}`);

      console.log('✅ Type metadata retrieved successfully');

      console.log('\n');
    }

    // Test 6: Logout
    console.log('📝 Test 6: Logout');
    const logoutResponse = await axios.delete(
      `${API_BASE_URL}/auth`,
      {
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/vnd.api+json'
        }
      }
    );

    console.log('Logout response:', JSON.stringify(logoutResponse.data, null, 2));
    console.log('✅ Logged out successfully');

    console.log('\n🎉 All tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('Error:', error.message);

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

testAPIv2();
