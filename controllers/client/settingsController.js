const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const Tenant = require('../../models/admin/Tenant');
const PaymentMethod = require('../../models/admin/PaymentMethod');
const { validatePatch } = require('../../services/settingsService');

const get = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId).lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  const availableMethods = await PaymentMethod.find({ enabled: true })
    .sort({ order: 1 })
    .select('code label mode')
    .lean();

  const enabledForTenant = tenant.settings?.paymentMethods || [];

  return ok(res, {
    settings: tenant.settings || {},
    business: {
      name: tenant.name,
      country: tenant.country,
      businessType: tenant.businessType,
      slug: tenant.slug,
    },
    paymentMethods: availableMethods,
    enabledPaymentMethods: enabledForTenant,
  });
});

const update = asyncHandler(async (req, res) => {
  const { patch, unknown } = validatePatch(req.body);

  if (!Object.keys(patch).length) {
    throw ApiError.badRequest(
      'NO_CHANGES',
      unknown.length
        ? `No valid fields. Unknown: ${unknown.join(', ')}`
        : 'No valid fields provided'
    );
  }

  const set = {};
  for (const [k, v] of Object.entries(patch)) {
    set[`settings.${k}`] = v;
  }

  const tenant = await Tenant.findByIdAndUpdate(
    req.tenantId,
    { $set: set },
    { new: true, runValidators: true }
  ).lean();

  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  return ok(res, tenant.settings);
});

const enablePayment = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const method = await PaymentMethod.findOne({ code, enabled: true }).lean();
  if (!method) {
    throw ApiError.badRequest('METHOD_UNAVAILABLE', 'Payment method not available');
  }

  const tenant = await Tenant.findById(req.tenantId);
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  const list = new Set(tenant.settings?.paymentMethods || []);
  list.add(code);
  tenant.settings.paymentMethods = Array.from(list);
  await tenant.save();

  return ok(res, { enabledPaymentMethods: tenant.settings.paymentMethods });
});

const disablePayment = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const tenant = await Tenant.findById(req.tenantId);
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  const list = (tenant.settings?.paymentMethods || []).filter((c) => c !== code);
  tenant.settings.paymentMethods = list;
  await tenant.save();

  return ok(res, { enabledPaymentMethods: list });
});

module.exports = { get, update, enablePayment, disablePayment };