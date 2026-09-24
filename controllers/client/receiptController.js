const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { assertObjectId } = require('../../utils/validateObjectId');
const { tenantFilter } = require('../../utils/tenantScope');
const { ApiError } = require('../../utils/apiError');
const Sale = require('../../models/client/Sale');
const Tenant = require('../../models/admin/Tenant');
const emailService = require('../../services/emailService');
const cloudinaryService = require('../../services/cloudinaryService');

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.saleId, 'saleId');

  const [sale, tenant] = await Promise.all([
    Sale.findOne(tenantFilter(req, { _id: req.params.saleId })).lean(),
    Tenant.findById(req.tenantId).lean(),
  ]);

  if (!sale) throw ApiError.notFound('SALE_NOT_FOUND', 'Sale not found');

  return ok(res, {
    business: {
      name: tenant?.name,
      logoUrl: tenant?.settings?.logoUrl || null,
      address: tenant?.settings?.address || null,
      phone: tenant?.settings?.phone || null,
    },
    sale,
    footer: tenant?.settings?.receiptFooter || 'Thank you for your business.',
  });
});

const pdf = asyncHandler(async (req, res) => {
  assertObjectId(req.params.saleId, 'saleId');

  const sale = await Sale.findOne(tenantFilter(req, { _id: req.params.saleId })).lean();
  if (!sale) throw ApiError.notFound('SALE_NOT_FOUND', 'Sale not found');

  if (sale.receiptPublicId) {
    const url = cloudinaryService.signedUrl(sale.receiptPublicId, { resource_type: 'raw' });
    return ok(res, { url });
  }

  return ok(res, { url: null, message: 'PDF not generated yet' });
});

const email = asyncHandler(async (req, res) => {
  assertObjectId(req.params.saleId, 'saleId');

  const { to } = req.body;
  if (!to) throw ApiError.badRequest('EMAIL_REQUIRED', 'Recipient email required');

  const [sale, tenant] = await Promise.all([
    Sale.findOne(tenantFilter(req, { _id: req.params.saleId })).lean(),
    Tenant.findById(req.tenantId).lean(),
  ]);

  if (!sale) throw ApiError.notFound('SALE_NOT_FOUND', 'Sale not found');

  emailService
    .sendInvoicePaidEmail(to, {
      businessName: tenant?.name || 'BizOS',
      customerName: req.body.customerName || 'Customer',
      invoiceNumber: sale.saleNumber,
      amount: sale.total,
      currency: sale.currency,
      paidAt: sale.createdAt?.toISOString(),
      paymentMethod: sale.paymentMethod,
    })
    .catch(() => {});

  return ok(res, { queued: true, to });
});

module.exports = { get, pdf, email };