const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const { tenantFilter } = require('../../utils/tenantScope');
const { ApiError } = require('../../utils/apiError');
const Invoice = require('../../models/client/Invoice');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = tenantFilter(req, { type: 'subscription' });

  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        'invoiceNumber customerSnapshot items subtotal discount tax total amountPaid amountDue currency status issuedAt dueDate paidAt paymentMethod createdAt'
      )
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'invoiceId');

  const invoice = await Invoice.findOne(
    tenantFilter(req, { _id: req.params.id, type: 'subscription' })
  ).lean();

  if (!invoice) throw ApiError.notFound('INVOICE_NOT_FOUND', 'Invoice not found');
  return ok(res, invoice);
});

const summary = asyncHandler(async (req, res) => {
  const result = await Invoice.aggregate([
    { $match: tenantFilter(req, { type: 'subscription' }) },
    {
      $group: {
        _id: null,
        total: { $sum: '$total' },
        totalPaid: { $sum: '$amountPaid' },
        totalDue: { $sum: '$amountDue' },
        count: { $sum: 1 },
        paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ['$dueDate', new Date()] },
                  { $ne: ['$status', 'paid'] },
                  { $ne: ['$status', 'cancelled'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return ok(
    res,
    result[0] || {
      total: 0,
      totalPaid: 0,
      totalDue: 0,
      count: 0,
      paid: 0,
      overdue: 0,
    }
  );
});

module.exports = { list, get, summary };