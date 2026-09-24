const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const paymentInstructionsService = require('../../services/paymentInstructionsService');
const mpesaService = require('../../services/mpesaService');
const Invoice = require('../../models/client/Invoice');

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

  return created(res, {
    checkoutRequestId: stk.checkoutRequestId,
    message: stk.customerMessage,
  });
});

module.exports = { getMethods, sendStkForInvoice };