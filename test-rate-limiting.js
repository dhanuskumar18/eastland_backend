const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testRateLimiting() {
  console.log('🧪 Testing Rate Limiting Implementation\n');

  // Test login endpoint rate limiting (5 attempts per minute)
  console.log('📝 Testing Login Rate Limiting (5 attempts per minute)...');
  
  for (let i = 1; i <= 7; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'wrongpassword'
      });
      console.log(`✅ Attempt ${i}: Status ${response.status}`);
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(`🚫 Attempt ${i}: Rate limited (429) - ${error.response.data.message}`);
      } else {
        console.log(`❌ Attempt ${i}: Status ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n📝 Testing Signup Rate Limiting (3 attempts per minute)...');
  
  // Test signup endpoint rate limiting (3 attempts per minute)
  for (let i = 1; i <= 5; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/signup`, {
        email: `test${i}@example.com`,
        password: 'password123'
      });
      console.log(`✅ Attempt ${i}: Status ${response.status}`);
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(`🚫 Attempt ${i}: Rate limited (429) - ${error.response.data.message}`);
      } else {
        console.log(`❌ Attempt ${i}: Status ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n📝 Testing Forgot Password Rate Limiting (3 attempts per 5 minutes)...');
  
  // Test forgot password endpoint rate limiting (3 attempts per 5 minutes)
  for (let i = 1; i <= 5; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/forgot-password`, {
        email: 'test@example.com'
      });
      console.log(`✅ Attempt ${i}: Status ${response.status}`);
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(`🚫 Attempt ${i}: Rate limited (429) - ${error.response.data.message}`);
      } else {
        console.log(`❌ Attempt ${i}: Status ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n✅ Rate limiting test completed!');
  console.log('\n📋 Rate Limiting Configuration Summary:');
  console.log('• Login: 5 attempts per minute');
  console.log('• Signup: 3 attempts per minute');
  console.log('• Refresh: 10 attempts per minute');
  console.log('• Forgot Password: 3 attempts per 5 minutes');
  console.log('• Verify OTP: 5 attempts per 5 minutes');
  console.log('• Reset Password: 3 attempts per 5 minutes');
  console.log('• Logout: No rate limiting (authenticated endpoint)');
}

// Run the test
testRateLimiting().catch(console.error);
