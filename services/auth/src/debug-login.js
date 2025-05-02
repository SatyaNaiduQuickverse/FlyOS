const bcrypt = require('bcrypt');

// Function to test password hashing and comparison
async function testPasswordValidation() {
  console.log('Testing password validation...');
  
  // Create a test hash
  const password = 'password';
  const hashedPassword = await bcrypt.hash(password, 10);
  
  console.log('Original password:', password);
  console.log('Hashed password:', hashedPassword);
  
  // Test comparison
  const isValid = await bcrypt.compare(password, hashedPassword);
  console.log('Validation result:', isValid);
  
  // Test with wrong password
  const isInvalid = await bcrypt.compare('wrongpassword', hashedPassword);
  console.log('Invalid validation result:', isInvalid);
}

// Run the test
testPasswordValidation()
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Test failed:', err));
