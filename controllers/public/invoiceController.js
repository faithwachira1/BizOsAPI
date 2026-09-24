const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const Invoice = require('../../models/client/Invoice');

const getByNumber = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ invoiceNumber: req.params.number })
    .select('invoiceNumber customerSnapshot items subtotal discount tax total amountPaid amountDue currency status issuedAt dueDate notes paymentInstructions')
    .lean();

  if (!invoice) throw ApiError.notFound('INVOICE_NOT_FOUND', 'Invoice not found');

  return ok(res, invoice);
});

module.exports = { getByNumber };