const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const paymentInstructionsService = require('../../services/paymentInstructionsService');
const mpesaService = require('../../services/mpesaService');
const Invoice = require('../../models/client/Invoice');
const Payment = require('../../models/client/Payment');

const getMethods = asyncHandler(async (_req, res) => {
  const methods = await paymentInstructionsService.getPublicPaymentMethods();
  return ok(res, methods);
});

const sendStkForInvoice = asyncHandler(async (req, res) => {
  const { invoiceNumber, phone } = req.body;

  if (!invoiceNumber || !phone) {
    throw ApiError.badRequest('MISSING_FIELDS', 'invoiceNumber and phone required');
  }

  const invoice = await Invoice.findOne({ invoiceNumber }).lean();
  if (!invoice) throw ApiError.notFound('INVOICE_NOT_FOUND', 'Invoice not found');

  if (invoice.status === 'paid') {
    throw ApiError.badRequest('ALREADY_PAID', 'This invoice is already paid');
  }
  if (invoice.status === 'cancelled') {
    throw ApiError.badRequest('INVOICE_CANCELLED', 'This invoice has been cancelled');
  }

  const stk = await mpesaService.stkPush({
    phone,
    amount: invoice.amountDue,
    accountRef: invoice.invoiceNumber,
    description: `Payment for ${invoice.invoiceNumber}`,
  });

  await Invoice.updateOne(
    { _id: invoice._id },
    {
      $set: {
        stkLastRequest: {
          checkoutRequestId: stk.checkoutRequestId,
          phone,
          requestedAt: new Date(),
        },
      },
    }
  );

  await Payment.create({
    tenantId: invoice.tenantId,
    purpose: 'invoice',
    invoiceId: invoice._id,
    method: 'mpesa',
    amount: invoice.amountDue,
    currency: invoice.currency,
    status: 'pending',
    providerRef: stk.checkoutRequestId,
    providerPayload: stk.raw,
  });

  return created(res, {
    checkoutRequestId: stk.checkoutRequestId,
    message: stk.customerMessage,
  });
});

const checkStkStatus = asyncHandler(async (req, res) => {
  const { checkoutRequestId } = req.params;

  if (!checkoutRequestId) {
    throw ApiError.badRequest('MISSING_FIELDS', 'checkoutRequestId required');
  }

  const payment = await Payment.findOne({
    purpose: 'invoice',
    $or: [
      { providerRef: checkoutRequestId },
      { mpesaReceipt: checkoutRequestId },
    ],
  }).lean();

  if (!payment) {
    throw ApiError.notFound('PAYMENT_NOT_FOUND', 'Payment not found');
  }

  const invoice = payment.invoiceId
    ? await Invoice.findById(payment.invoiceId)
        .select('invoiceNumber status amountPaid amountDue currency')
        .lean()
    : null;

  return ok(res, {
    status: payment.status,
    invoiceNumber: invoice?.invoiceNumber || null,
    invoiceStatus: invoice?.status || null,
    amountPaid: invoice?.amountPaid || 0,
    amountDue: invoice?.amountDue || 0,
    currency: invoice?.currency || payment.currency,
    receipt: payment.mpesaReceipt || null,
    failureReason: payment.failureReason || null,
  });
});

module.exports = { getMethods, sendStkForInvoice, checkStkStatus };