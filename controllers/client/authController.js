const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const User = require('../../models/client/User');
const Tenant = require('../../models/admin/Tenant');
const Plan = require('../../models/admin/Plan');
const Invoice = require('../../models/client/Invoice');
const emailService = require('../../services/emailService');
const {
  comparePassword,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../../utils/jwt');

async function loadLatestInvoice(tenantId) {
  const invoice = await Invoice.findOne({ tenantId })
    .sort({ createdAt: -1 })
    .select('invoiceNumber status amountDue amountPaid currency dueDate pdfUrl')
    .lean();

  if (!invoice) return null;

  return {
    number: invoice.invoiceNumber,
    status: invoice.status,
    amountDue: invoice.amountDue,
    amountPaid: invoice.amountPaid,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    pdfUrl: invoice.pdfUrl || null,
    payUrl: `${env.appUrl}/pay/${invoice.invoiceNumber}`,
  };
}

const logout = asyncHandler(async (_req, res) => {
  return ok(res, { loggedOut: true });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'User not found');

  const tenant = await Tenant.findById(req.user.tenantId).lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  const plan = await Plan.findOne({ code: tenant.planId }).lean();

  const invoice =
    req.user.scope === 'pending' ? await loadLatestInvoice(tenant._id) : null;

  return ok(res, {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
    },
    tenant: {
      id: tenant._id,
      name: tenant.name,
      status: tenant.status,
      planId: tenant.planId,
    },
    plan: plan
      ? {
          code: plan.code,
          name: plan.name,
          limits: plan.limits,
          features: plan.features,
        }
      : null,
    invoice,
    scope: req.user.scope,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('NO_REFRESH', 'Refresh token required');

  const payload = verifyRefreshToken(refreshToken);
  if (payload.scope === 'platform') throw ApiError.forbidden('NOT_CLIENT', 'Invalid scope');

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('INVALID_USER', 'User not found');
  if (!['active', 'pending_user'].includes(user.status)) {
    throw ApiError.forbidden('INACTIVE', 'Account inactive');
  }

  const scope = user.status === 'active' ? 'active' : 'pending';
  const newPayload = {
    sub: user._id.toString(),
    tenantId: user.tenantId.toString(),
    role: user.role,
    scope,
  };

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

  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'User not found');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('INVALID_PASSWORD', 'Current password is incorrect');

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  emailService
    .sendPasswordChangedEmail(user.email, {
      fullName: user.fullName,
      when: new Date().toISOString(),
      ip: req.ip,
    })
    .catch(() => {});

  return ok(res, { changed: true });
});

module.exports = { logout, me, refresh, changePassword };