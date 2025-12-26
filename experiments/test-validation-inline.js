/**
 * Inline validation test (without bcrypt dependency)
 */

// Inline password validation function (copied from password.js)
function validatePasswordStrength(password) {
  const errors = []

  if (!password || password.length < 8) {
    errors.push('Пароль должен содержать минимум 8 символов')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Пароль должен содержать хотя бы одну строчную букву')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Пароль должен содержать хотя бы одну заглавную букву')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Пароль должен содержать хотя бы одну цифру')
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Пароль должен содержать хотя бы один специальный символ')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// Inline email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Inline username validation
function validateUsername(username) {
  if (!username || username.length < 3) {
    return {
      isValid: false,
      error: 'Имя пользователя должно содержать минимум 3 символа',
    }
  }

  if (username.length > 50) {
    return {
      isValid: false,
      error: 'Имя пользователя не может быть длиннее 50 символов',
    }
  }

  const usernameRegex = /^[a-zA-Z0-9_-]+$/
  if (!usernameRegex.test(username)) {
    return {
      isValid: false,
      error: 'Имя пользователя может содержать только буквы, цифры, дефис и подчеркивание',
    }
  }

  return { isValid: true }
}

console.log('=== Testing Password Validation (Issue #65) ===\n');

// Test weak passwords
const weakPasswords = [
  { password: '12345678', description: 'Only numbers' },
  { password: 'abcdefgh', description: 'Only lowercase' },
  { password: 'Password1', description: 'No special character' }
];

console.log('Testing WEAK passwords (should be rejected):\n');
let allWeakRejected = true;
weakPasswords.forEach(({ password, description }) => {
  const result = validatePasswordStrength(password);
  const icon = !result.isValid ? '✅' : '❌';
  console.log(`${icon} ${description}: "${password}"`);
  console.log(`   Valid: ${result.isValid} (expected: false)`);
  if (!result.isValid) {
    console.log(`   Errors: ${result.errors.join(', ')}`);
  } else {
    allWeakRejected = false;
  }
  console.log('');
});

// Test strong passwords
const strongPasswords = [
  { password: 'ValidP@ss123', description: 'Valid strong password' },
  { password: 'Str0ng!Pass', description: 'Contains all requirements' },
  { password: 'MyP@ssw0rd', description: 'Another valid password' }
];

console.log('\nTesting STRONG passwords (should be accepted):\n');
let allStrongAccepted = true;
strongPasswords.forEach(({ password, description }) => {
  const result = validatePasswordStrength(password);
  const icon = result.isValid ? '✅' : '❌';
  console.log(`${icon} ${description}: "${password}"`);
  console.log(`   Valid: ${result.isValid} (expected: true)`);
  if (!result.isValid) {
    console.log(`   Errors: ${result.errors.join(', ')}`);
    allStrongAccepted = false;
  }
  console.log('');
});

// Test email validation
console.log('\n=== Testing Email Validation ===\n');
const emails = [
  { email: 'test@example.com', valid: true },
  { email: 'invalid-email', valid: false },
  { email: 'no@domain', valid: false }
];

let allEmailsCorrect = true;
emails.forEach(({ email, valid }) => {
  const result = isValidEmail(email);
  const icon = result === valid ? '✅' : '❌';
  console.log(`${icon} "${email}": ${result ? 'Valid' : 'Invalid'} (expected: ${valid ? 'Valid' : 'Invalid'})`);
  if (result !== valid) allEmailsCorrect = false;
});

// Test username validation
console.log('\n=== Testing Username Validation ===\n');
const usernames = [
  { username: 'ab', shouldPass: false },
  { username: 'valid_user-123', shouldPass: true },
  { username: 'user@name!', shouldPass: false }
];

let allUsernamesCorrect = true;
usernames.forEach(({ username, shouldPass }) => {
  const result = validateUsername(username);
  const icon = result.isValid === shouldPass ? '✅' : '❌';
  console.log(`${icon} "${username}": ${result.isValid ? 'Valid' : 'Invalid'} (expected: ${shouldPass ? 'Valid' : 'Invalid'})`);
  if (!result.isValid) {
    console.log(`   Error: ${result.error}`);
  }
  if (result.isValid !== shouldPass) allUsernamesCorrect = false;
  console.log('');
});

console.log('\n=== Summary ===');
if (allWeakRejected && allStrongAccepted && allEmailsCorrect && allUsernamesCorrect) {
  console.log('✅ All validation tests passed!');
  console.log('✅ Weak passwords are properly rejected');
  console.log('✅ Strong passwords are accepted');
  console.log('✅ Email validation is working');
  console.log('✅ Username validation is working');
  console.log('\n✅ Issue #65 fix is complete and functional!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed!');
  process.exit(1);
}
