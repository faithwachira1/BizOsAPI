const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const SuperAdmin = require('../../models/admin/SuperAdmin');
const emailService = require('../../services/emailService');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  comparePassword,
  hashPassword,
} = require('../../utils/jwt');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw ApiError.badRequest('MISSING_FIELDS', 'Email and password required');

  const admin = await SuperAdmin.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!admin) throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
  if (admin.status !== 'active') throw ApiError.forbidden('SUSPENDED', 'Account suspended');

  const valid = await comparePassword(password, admin.passwordHash);
  if (!valid) throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');

  const payload = { sub: admin._id.toString(), role: admin.role, scope: 'platform' };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  admin.lastLoginAt = new Date();
  await admin.save();

  return ok(res, {
    accessToken,
    refreshToken,
    admin: {
      id: admin._id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
    },
  });
});

const logout = asyncHandler(async (_req, res) => {
  return ok(res, { loggedOut: true });
});

const me = asyncHandler(async (req, res) => {
  const admin = await SuperAdmin.findById(req.admin.id).lean();
  if (!admin) throw ApiError.notFound('ADMIN_NOT_FOUND', 'Admin not found');
  return ok(res, {
    id: admin._id,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    lastLoginAt: admin.lastLoginAt,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('NO_REFRESH', 'Refresh token required');

  const payload = verifyRefreshToken(refreshToken);
  if (payload.scope !== 'platform') throw ApiError.forbidden('NOT_ADMIN', 'Invalid scope');

  const admin = await SuperAdmin.findById(payload.sub);
  if (!admin || admin.status !== 'active') {
    throw ApiError.unauthorized('INVALID_ADMIN', 'Admin not found');
  }

  const newPayload = { sub: admin._id.toString(), role: admin.role, scope: 'platform' };
  return ok(res, {
    accessToken: signAccessToken(newPayload),
    refreshToken: signRefreshToken(newPayload),
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('MISSING_FIELDS', 'Both passwords required');
  }
  if (newPassword.length < 8) {
    throw ApiError.badRequest('WEAK_PASSWORD', 'Password must be at least 8 characters');
  }

  const admin = await SuperAdmin.findById(req.admin.id).select('+passwordHash');
  if (!admin) throw ApiError.notFound('ADMIN_NOT_FOUND', 'Admin not found');

  const valid = await comparePassword(currentPassword, admin.passwordHash);
  if (!valid) throw ApiError.unauthorized('INVALID_PASSWORD', 'Current password is incorrect');

  admin.passwordHash = await hashPassword(newPassword);
  await admin.save();

  emailService
    .sendPasswordChangedEmail(admin.email, {
      fullName: admin.fullName,
      when: new Date().toISOString(),
      ip: req.ip,
    })
    .catch(() => {});

  return ok(res, { changed: true });
});

module.exports = { login, logout, me, refresh, changePassword };