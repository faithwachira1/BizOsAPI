const crypto = require('crypto');

function numericOtp(len = 6) {
  return Array.from({ length: len }, () => crypto.randomInt(0, 10)).join('');
}

function token(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function shortCode(len = 8) {
  return crypto.randomBytes(len).toString('base64url').slice(0, len);
}

module.exports = { numericOtp, token, shortCode };