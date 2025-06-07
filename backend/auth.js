const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');

function getSharedPassword() {
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    return config.sharedPassword;
  } catch (error) {
    console.error('Error reading or parsing config file for password:', error);
    // Fallback or throw error, depending on desired behavior
    // For now, let's throw an error if the password cannot be retrieved.
    throw new Error('Could not retrieve shared password.');
  }
}

function verifyPassword(providedPassword) {
  if (!providedPassword) {
    return false;
  }
  const storedPassword = getSharedPassword();
  return providedPassword === storedPassword;
}

module.exports = {
  verifyPassword,
  getSharedPassword // Exporting this might be useful for other backend operations if needed
};

// Example Usage (can be commented out or removed)
if (require.main === module) {
  console.log('Verifying "your_secure_password_replace_me":', verifyPassword('your_secure_password_replace_me'));
  console.log('Verifying "wrong_password":', verifyPassword('wrong_password'));
  try {
    console.log('Attempting to get raw shared password:', getSharedPassword());
  } catch (e) {
    console.error(e.message);
  }
}
