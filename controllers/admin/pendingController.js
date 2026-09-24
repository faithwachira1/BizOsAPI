const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { logger } = require('../../utils/logger');

const Tenant = require('../../models/admin/Tenant');
const User = require('../../models/client/User');
const PendingActivation = require('../../models/admin/PendingActivation');
const PaymentMethod = require('../../models/admin/PaymentMethod');
const Invoice = require('../../models/client/Invoice');
const AdminAction = require('../../models/admin/AdminAction');
const emailService = require('../../services/emailService');

async function seedCashPayment(tenantId) {
  const cash = await PaymentMethod.findOne({ code: 'cash' }).lean();
  if (!cash) return;

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return;

  const list = new Set(tenant.settings?.paymentMethods || []);
  list.add('cash');
  tenant.settings = { ...tenant.settings, paymentMethods: Array.from(list) };
  await tenant.save();
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { status: { $in: ['pending', 'in_review'] } };

  const [items, total] = await Promise.all([
    PendingActivation.find(filter)
      .sort({ priority: -1, registeredAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PendingActivation.countDocuments(filter),
  ]);

  const tenantIds = items.map((i) => i.tenantId);

  const [tenants, owners, invoices] = await Promise.all([
    Tenant.find({ _id: { $in: tenantIds } }).lean(),
    User.find({ tenantId: { $in: tenantIds }, role: 'owner' })
      .select('tenantId fullName email phone')
      .lean(),
    Invoice.find({ tenantId: { $in: tenantIds } })
      .select('tenantId invoiceNumber total amountDue currency status dueDate issuedAt')
      .lean(),
  ]);

  const tenantsById = Object.fromEntries(tenants.map((t) => [t._id.toString(), t]));
  const ownersByTenant = Object.fromEntries(owners.map((o) => [o.tenantId.toString(), o]));
  const invoicesByTenant = Object.fromEntries(invoices.map((i) => [i.tenantId.toString(), i]));

  const enriched = items.map((i) => ({
    ...i,
    tenant: tenantsById[i.tenantId.toString()] || null,
    owner: ownersByTenant[i.tenantId.toString()] || null,
    invoice: invoicesByTenant[i.tenantId.toString()] || null,
  }));

  return paginated(res, enriched, page, limit, total);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'pendingId');

  const pending = await PendingActivation.findById(req.params.id).lean();
  if (!pending) throw ApiError.notFound('PENDING_NOT_FOUND', 'Pending record not found');

  const tenant = await Tenant.findById(pending.tenantId).lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  const owner = await User.findOne({ tenantId: pending.tenantId, role: 'owner' })
    .select('fullName email phone status emailVerified lastLoginAt createdAt')
    .lean();

  const invoice = await Invoice.findOne({ tenantId: pending.tenantId })
    .sort({ createdAt: -1 })
    .lean();

  const actions = await AdminAction.find({ tenantId: pending.tenantId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const staff = await User.find({ tenantId: pending.tenantId })
    .select('fullName email role status createdAt')
    .lean();

  return ok(res, {
    pending,
    tenant,
    owner,
    invoice,
    actions,
    staff,
    counts: {
      staff: staff.length,
      actions: actions.length,
    },
  });
});

const approve = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'pendingId');

  const pending = await PendingActivation.findById(req.params.id);
  if (!pending) throw ApiError.notFound('PENDING_NOT_FOUND', 'Pending record not found');
  if (pending.status === 'approved') {
    throw ApiError.badRequest('ALREADY_APPROVED', 'Already approved');
  }

  const tenant = await Tenant.findById(pending.tenantId);
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  tenant.status = 'active';
  tenant.approvedAt = new Date();
  tenant.approvedBy = req.admin.id;
  await tenant.save();

  await User.updateMany(
    { tenantId: tenant._id, status: 'pending_user' },
    { $set: { status: 'active' } }
  );

  await seedCashPayment(tenant._id);

  pending.status = 'approved';
  pending.decision = 'approved';
  pending.reviewedAt = new Date();
  pending.reviewedBy = req.admin.id;
  pending.notes = req.body.notes || pending.notes;
  await pending.save();

  const owner = await User.findOne({ tenantId: tenant._id, role: 'owner' }).lean();
  if (owner?.email) {
    emailService
      .sendWelcomeEmail(owner.email, {
        name: owner.fullName,
        businessName: tenant.name,
        email: owner.email,
        loginUrl: `${env.appUrl}/login`,
      })
      .catch(() => {});
  }

  return ok(res, { approved: true, tenantId: tenant._id });
});

const reject = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'pendingId');

  const { reason } = req.body;
  if (!reason) throw ApiError.badRequest('REASON_REQUIRED', 'Rejection reason required');

  const pending = await PendingActivation.findById(req.params.id);
  if (!pending) throw ApiError.notFound('PENDING_NOT_FOUND', 'Pending record not found');

  const tenant = await Tenant.findById(pending.tenantId);
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  tenant.status = 'rejected';
  tenant.rejectedAt = new Date();
  tenant.rejectedBy = req.admin.id;
  tenant.rejectionReason = reason;
  await tenant.save();

  await User.updateMany({ tenantId: tenant._id }, { $set: { status: 'rejected' } });

  pending.status = 'rejected';
  pending.decision = 'rejected';
  pending.rejectionReason = reason;
  pending.reviewedAt = new Date();
  pending.reviewedBy = req.admin.id;
  await pending.save();

  const owner = await User.findOne({ tenantId: tenant._id, role: 'owner' }).lean();
  if (owner?.email) {
    emailService
      .sendRejectionEmail(owner.email, {
        name: owner.fullName,
        businessName: tenant.name,
        reason,
      })
      .catch(() => {});
  }

  return ok(res, { rejected: true });
});

const confirmPayment = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'pendingId');

  const { method, reference, note } = req.body;
  if (!method) throw ApiError.badRequest('METHOD_REQUIRED', 'Payment method required');

  const pending = await PendingActivation.findById(req.params.id).lean();
  if (!pending) throw ApiError.notFound('PENDING_NOT_FOUND', 'Pending record not found');

  const invoice = await Invoice.findOne({ tenantId: pending.tenantId }).sort({
    createdAt: -1,
  });
  if (!invoice) throw ApiError.notFound('INVOICE_NOT_FOUND', 'No invoice for this tenant');
  if (invoice.status === 'paid') {
    throw ApiError.badRequest('ALREADY_PAID', 'Invoice already paid');
  }

  const paidAt = new Date();
  const amountPaid = invoice.amountDue;

  invoice.status = 'paid';
  invoice.amountPaid = amountPaid;
  invoice.amountDue = 0;
  invoice.paidAt = paidAt;
  invoice.paymentMethod = method;
  invoice.paymentRef = reference || null;
  if (note) {
    invoice.notes = `${invoice.notes || ''}\nAdmin note: ${note}`.trim();
  }
  await invoice.save();

  await AdminAction.create({
    adminId: req.admin.id,
    tenantId: pending.tenantId,
    action: 'pending.confirm_payment',
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      amount: amountPaid,
      currency: invoice.currency,
      method,
      reference: reference || null,
      note: note || null,
    },
    ip: req.ip,
  });

  const tenant = await Tenant.findById(pending.tenantId).lean();
  const owner = await User.findOne({ tenantId: pending.tenantId, role: 'owner' })
    .select('email fullName')
    .lean();

  let emailSent = false;
  if (owner?.email) {
    try {
      await emailService.sendPaymentReceivedEmail(owner.email, {
        businessName: tenant?.name || 'BizOS',
        customerName: owner.fullName,
        invoiceNumber: invoice.invoiceNumber,
        amount: amountPaid,
        currency: invoice.currency,
        paidAt: paidAt.toISOString(),
        paymentMethod: method,
        paymentReference: reference || null,
        notes: note || null,
      });
      emailSent = true;
    } catch (err) {
      logger.error({ err: err.message }, 'paymentReceived email failed');
    }
  }

  return ok(res, {
    invoice: {
      _id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
      paidAt: invoice.paidAt,
      paymentMethod: invoice.paymentMethod,
      paymentRef: invoice.paymentRef,
    },
    emailSent,
  });
});

const addNotes = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'pendingId');

  const pending = await PendingActivation.findByIdAndUpdate(
    req.params.id,
    { $set: { notes: req.body.notes || '' } },
    { new: true }
  ).lean();

  if (!pending) throw ApiError.notFound('PENDING_NOT_FOUND', 'Pending record not found');
  return ok(res, pending);
});

module.exports = { list, get, approve, reject, confirmPayment, addNotes };