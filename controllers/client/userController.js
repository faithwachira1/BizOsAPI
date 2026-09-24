const crypto = require('crypto');
const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const { tenantFilter } = require('../../utils/tenantScope');
const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const User = require('../../models/client/User');
const Tenant = require('../../models/admin/Tenant');
const emailService = require('../../services/emailService');
const planService = require('../../services/planService');

function tempPassword() {
  return crypto.randomBytes(6).toString('base64url').slice(0, 10);
}

async function checkRoleLimit(tenantId, role) {
  if (role === 'owner') return planService.checkOwnerLimit(tenantId, User);
  if (role === 'manager') return planService.checkManagerLimit(tenantId, User);
  if (role === 'cashier') return planService.checkCashierLimit(tenantId, User);
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = tenantFilter(req);
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'userId');
  const user = await User.findOne(tenantFilter(req, { _id: req.params.id })).lean();
  if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'User not found');
  return ok(res, user);
});

const invite = asyncHandler(async (req, res) => {
  const { fullName, email, role } = req.body;
  if (!fullName || !email || !role) {
    throw ApiError.badRequest('MISSING_FIELDS', 'fullName, email, role required');
  }
  if (!['owner', 'manager', 'cashier'].includes(role)) {
    throw ApiError.badRequest('INVALID_ROLE', 'Invalid role');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict('EMAIL_TAKEN', 'Email already in use');

  await checkRoleLimit(req.tenantId, role);

  const temp = tempPassword();

  const user = await User.create({
    tenantId: req.tenantId,
    email: email.toLowerCase(),
    phone: req.body.phone,
    fullName,
    role,
    passwordHash: temp,
    status: 'active',
    mustChangePassword: true,
    invitedBy: req.user.id,
  });

  const tenant = await Tenant.findById(req.tenantId).lean();

  emailService
    .sendStaffWelcomeEmail(email, {
      fullName,
      businessName: tenant?.name || 'BizOS',
      email: email.toLowerCase(),
      temporaryPassword: temp,
      role,
      loginUrl: `${env.appUrl}/login`,
    })
    .catch(() => {});

  return created(res, {
    id: user._id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
  });
});

const updateRole = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'userId');

  const { role } = req.body;
  if (!['owner', 'manager', 'cashier'].includes(role)) {
    throw ApiError.badRequest('INVALID_ROLE', 'Invalid role');
  }

  const user = await User.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'User not found');

  const oldRole = user.role;
  if (oldRole === role) return ok(res, { id: user._id, role: user.role });

  if (oldRole === 'owner' && role !== 'owner') {
    const ownerCount = await User.countDocuments({
      tenantId: req.tenantId,
      role: 'owner',
      status: 'active',
    });
    if (ownerCount <= 1) {
      throw ApiError.badRequest('LAST_OWNER', 'Cannot remove the last owner');
    }
  }

  if (role === 'owner' || role === 'manager' || role === 'cashier') {
    await checkRoleLimit(req.tenantId, role);
  }

  user.role = role;
  await user.save();

  const tenant = await Tenant.findById(req.tenantId).lean();
  emailService
    .sendRoleChangedEmail(user.email, {
      fullName: user.fullName,
      businessName: tenant?.name || 'BizOS',
      oldRole,
      newRole: role,
    })
    .catch(() => {});

  return ok(res, { id: user._id, role: user.role });
});

const deactivate = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'userId');

  const user = await User.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'User not found');

  if (user.role === 'owner') {
    const ownerCount = await User.countDocuments({
      tenantId: req.tenantId,
      role: 'owner',
      status: 'active',
    });
    if (ownerCount <= 1) {
      throw ApiError.badRequest('LAST_OWNER', 'Cannot deactivate the last owner');
    }
  }

  user.status = 'suspended';
  await user.save();

  const tenant = await Tenant.findById(req.tenantId).lean();
  emailService
    .sendStaffDeactivatedEmail(user.email, {
      fullName: user.fullName,
      businessName: tenant?.name || 'BizOS',
    })
    .catch(() => {});

  return ok(res, { deactivated: true });
});

const resetPassword = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'userId');

  const user = await User.findOne(tenantFilter(req, { _id: req.params.id })).select(
    '+passwordHash'
  );
  if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'User not found');

  const temp = tempPassword();
  user.passwordHash = temp;
  user.mustChangePassword = true;
  await user.save();

  const tenant = await Tenant.findById(req.tenantId).lean();
  emailService
    .sendStaffWelcomeEmail(user.email, {
      fullName: user.fullName,
      businessName: tenant?.name || 'BizOS',
      email: user.email,
      temporaryPassword: temp,
      role: user.role,
      loginUrl: `${env.appUrl}/login`,
    })
    .catch(() => {});

  return ok(res, { reset: true });
});

module.exports = { list, get, invite, updateRole, deactivate, resetPassword };