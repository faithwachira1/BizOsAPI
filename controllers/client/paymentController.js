const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const { tenantFilter } = require('../../utils/tenantScope');
const { ApiError } = require('../../utils/apiError');
const Payment = require('../../models/client/Payment');
const Sale = require('../../models/client/Sale');
const mpesaService = require('../../services/mpesaService');

const MANUAL_METHODS = ['cash', 'mpesa_send', 'mpesa_till', 'mpesa_paybill', 'bank'];

const initiate = asyncHandler(async (req, res) => {
  const { saleId, method, phone, amount } = req.body;
  if (!method) throw ApiError.badRequest('METHOD_REQUIRED', 'Payment method required');
  if (!saleId) throw ApiError.badRequest('SALE_REQUIRED', 'Sale required');

  const sale = await Sale.findOne(tenantFilter(req, { _id: saleId })).lean();
  if (!sale) throw ApiError.notFound('SALE_NOT_FOUND', 'Sale not found');

  if (method === 'mpesa_stk') {
    if (!phone) throw ApiError.badRequest('PHONE_REQUIRED', 'Phone required for M-Pesa STK');

    const stk = await mpesaService.stkPush({
      phone,
      amount: amount || sale.total,
      accountRef: sale.saleNumber,
      description: `Payment for ${sale.saleNumber}`,
    });

    const payment = await Payment.create({
      tenantId: req.tenantId,
      saleId: sale._id,
      method: 'mpesa_stk',
      amount: amount || sale.total,
      currency: sale.currency,
      status: 'pending',
      providerRef: stk.checkoutRequestId,
      providerPayload: stk.raw,
    });

    return created(res, {
      paymentId: payment._id,
      checkoutRequestId: stk.checkoutRequestId,
      message: stk.customerMessage,
    });
  }

  if (method === 'stripe') {
    return created(res, {
      message: 'Stripe flow not yet implemented',
    });
  }

  throw ApiError.badRequest('INVALID_METHOD', 'Use /payments/manual for manual methods');
});

const recordManual = asyncHandler(async (req, res) => {
  const { saleId, method, amount, reference, note, amountReceived } = req.body;

  if (!saleId || !method) {
    throw ApiError.badRequest('MISSING_FIELDS', 'saleId and method required');
  }

  if (!MANUAL_METHODS.includes(method)) {
    throw ApiError.badRequest('INVALID_METHOD', 'Not a manual method');
  }

  const sale = await Sale.findOne(tenantFilter(req, { _id: saleId })).lean();
  if (!sale) throw ApiError.notFound('SALE_NOT_FOUND', 'Sale not found');

  if (method !== 'cash' && !reference) {
    throw ApiError.badRequest('REFERENCE_REQUIRED', 'Reference required for this method');
  }

  const paidAmount = amount || sale.total;

  const payload = {
    manual: true,
    reference: reference || null,
    note: note || null,
    recordedBy: req.user.id,
    recordedAt: new Date().toISOString(),
  };

  if (method === 'cash') {
    payload.amountReceived = amountReceived || paidAmount;
    payload.change = Math.max(0, (amountReceived || paidAmount) - paidAmount);
  }

  const payment = await Payment.create({
    tenantId: req.tenantId,
    saleId: sale._id,
    method,
    amount: paidAmount,
    currency: sale.currency,
    status: 'success',
    providerRef: reference || null,
    providerPayload: payload,
  });

  await Sale.updateOne(
    tenantFilter(req, { _id: sale._id }),
    { $set: { paymentStatus: 'paid', paymentMethod: method } }
  );

  return created(res, payment.toObject());
});

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = tenantFilter(req);
  if (req.query.saleId) filter.saleId = req.query.saleId;
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const refund = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'paymentId');

  const payment = await Payment.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!payment) throw ApiError.notFound('PAYMENT_NOT_FOUND', 'Payment not found');
  if (payment.status !== 'success') {
    throw ApiError.badRequest('NOT_REFUNDABLE', 'Only successful payments can be refunded');
  }

  payment.status = 'refunded';
  payment.refundedAt = new Date();
  payment.refundedBy = req.user.id;
  await payment.save();

  await Sale.updateOne(
    tenantFilter(req, { _id: payment.saleId }),
    { $set: { paymentStatus: 'refunded' } }
  );

  return ok(res, payment.toObject());
});

module.exports = { initiate, recordManual, list, refund };