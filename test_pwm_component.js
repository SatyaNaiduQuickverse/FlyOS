// test_pwm_component.js - Test PWM component token access
console.log('Testing PWM component token access...');

// Simulate localStorage token
const mockToken = 'REPLACE_WITH_ACTUAL_TOKEN';
localStorage.setItem('token', mockToken);

// Test token retrieval
const retrievedToken = localStorage.getItem('token');
console.log('Token retrieved:', retrievedToken ? 'YES' : 'NO');
console.log('Token length:', retrievedToken?.length || 0);

// Test API call format
const testApiCall = async (droneId, command) => {
  try {
    const response = await fetch(`/api/drones/${droneId}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${retrievedToken}`
      },
      body: JSON.stringify({
        commandType: command,
        parameters: {},
        timestamp: new Date().toISOString()
      })
    });
    
    console.log('API Response Status:', response.status);
    const data = await response.json();
    console.log('API Response Data:', data);
    
  } catch (error) {
    console.error('API Call Error:', error);
  }
};

// Test with drone-001
testApiCall('drone-001', 'arm');
