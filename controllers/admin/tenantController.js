const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const { ApiError } = require('../../utils/apiError');

const Tenant = require('../../models/admin/Tenant');
const User = require('../../models/client/User');
const Product = require('../../models/client/Product');
const Customer = require('../../models/client/Customer');
const Sale = require('../../models/client/Sale');
const Invoice = require('../../models/client/Invoice');
const PendingActivation = require('../../models/admin/PendingActivation');
const Plan = require('../../models/admin/Plan');
const emailService = require('../../services/emailService');
const tenantService = require('../../services/tenantService');
const planService = require('../../services/planService');
const { signAccessToken } = require('../../utils/jwt');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, country, search } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (country) filter.country = country;
  if (search) filter.name = { $regex: search, $options: 'i' };

  const [items, total] = await Promise.all([
    Tenant.find(filter).sort({ registeredAt: -1 }).skip(skip).limit(limit).lean(),
    Tenant.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'tenantId');

  const tenant = await Tenant.findById(req.params.id).lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  const tenantId = tenant._id;

  const [
    owner,
    pending,
    productCount,
    customerCount,
    saleCount,
    staffCount,
    staffByRole,
    salesAggregate,
    lastSale,
    invoiceCount,
    paidInvoiceCount,
  ] = await Promise.all([
    User.findOne({ tenantId, role: 'owner' })
      .select('fullName email phone status')
      .lean(),
    PendingActivation.findOne({ tenantId }).lean(),
    Product.countDocuments({ tenantId, active: true }),
    Customer.countDocuments({ tenantId, active: true }),
    Sale.countDocuments({ tenantId, voided: { $ne: true } }),
    User.countDocuments({ tenantId, status: 'active' }),
    User.aggregate([
      { $match: { tenantId, status: 'active' } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      { $match: { tenantId, voided: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
    Sale.findOne({ tenantId, voided: { $ne: true } })
      .sort({ createdAt: -1 })
      .select('saleNumber total currency createdAt')
      .lean(),
    Invoice.countDocuments({ tenantId }),
    Invoice.countDocuments({ tenantId, status: 'paid' }),
  ]);

  const roleMap = Object.fromEntries(staffByRole.map((r) => [r._id, r.count]));
  const salesSum = salesAggregate[0] || { total: 0, count: 0 };

  return ok(res, {
    tenant,
    owner,
    pending,
    counts: {
      products: productCount,
      customers: customerCount,
      sales: saleCount,
      staff: staffCount,
    },
    staffByRole: {
      owners: roleMap.owner || 0,
      managers: roleMap.manager || 0,
      cashiers: roleMap.cashier || 0,
    },
    salesSummary: {
      total: salesSum.total,
      count: salesSum.count,
      currency: tenant.settings?.currency || 'KES',
    },
    lastSale: lastSale || null,
    invoices: {
      total: invoiceCount,
      paid: paidInvoiceCount,
    },
  });
});

const update = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'tenantId');

  const allowed = ['name', 'country', 'businessType', 'planId'];
  const patch = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];

  if (patch.planId) {
    const plan = await Plan.findOne({ code: patch.planId }).lean();
    if (!plan) throw ApiError.badRequest('INVALID_PLAN', `Plan '${patch.planId}' not found`);
  }

  const tenant = await Tenant.findByIdAndUpdate(req.params.id, patch, { new: true }).lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  if (patch.planId) {
    planService.invalidateCache();
  }

  return ok(res, tenant);
});

const suspend = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'tenantId');

  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  tenant.status = 'suspended';
  tenant.suspendedAt = new Date();
  tenant.suspendedBy = req.admin.id;
  tenant.suspendedReason = req.body.reason || null;
  await tenant.save();

  await User.updateMany({ tenantId: tenant._id }, { $set: { status: 'suspended' } });

  const owner = await User.findOne({ tenantId: tenant._id, role: 'owner' }).lean();
  if (owner?.email) {
    emailService
      .sendStaffDeactivatedEmail(owner.email, {
        fullName: owner.fullName,
        businessName: tenant.name,
      })
      .catch(() => {});
  }

  return ok(res, { suspended: true });
});

const reactivate = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'tenantId');

  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  tenant.status = 'active';
  tenant.suspendedAt = null;
  tenant.suspendedBy = null;
  tenant.suspendedReason = null;
  await tenant.save();

  await User.updateMany(
    { tenantId: tenant._id, status: 'suspended' },
    { $set: { status: 'active' } }
  );

  return ok(res, { reactivated: true });
});

const remove = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'tenantId');

  const tenant = await Tenant.findById(req.params.id).lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  const purged = await tenantService.purge(req.params.id);

  return ok(res, {
    deleted: true,
    tenantId: req.params.id,
    tenantName: tenant.name,
    purged,
  });
});

const impersonate = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'tenantId');

  const tenant = await Tenant.findById(req.params.id).lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  const owner = await User.findOne({ tenantId: tenant._id, role: 'owner' }).lean();
  if (!owner) throw ApiError.notFound('OWNER_NOT_FOUND', 'Owner not found');

  const token = signAccessToken({
    sub: owner._id.toString(),
    tenantId: tenant._id.toString(),
    role: 'owner',
    scope: 'active',
    impersonatedBy: req.admin.id,
  });

  return ok(res, {
    accessToken: token,
    tenant: { id: tenant._id, name: tenant.name },
    owner: { id: owner._id, email: owner.email, fullName: owner.fullName },
  });
});

module.exports = { list, get, update, suspend, reactivate, remove, impersonate };