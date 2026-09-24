const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { ApiError } = require('./apiError');

const BCRYPT_ROUNDS = 12;

async function hashPassword(plain) {
  if (!plain || plain.length < 8) {
    throw ApiError.badRequest('WEAK_PASSWORD', 'Password must be at least 8 characters');
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function comparePassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

function signAccessToken(payload) {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.accessTtl,
    issuer: 'bizos',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl,
    issuer: 'bizos',
  });
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwt.secret, { issuer: 'bizos' });
  } catch {
    throw ApiError.unauthorized('INVALID_TOKEN', 'Access token invalid or expired');
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.jwt.refreshSecret, { issuer: 'bizos' });
  } catch {
    throw ApiError.unauthorized('INVALID_REFRESH', 'Refresh token invalid or expired');
  }
}

function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};