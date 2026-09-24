const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const { tenantFilter } = require('../../utils/tenantScope');
const { ApiError } = require('../../utils/apiError');
const Invoice = require('../../models/client/Invoice');
const service = require('../../services/customerInvoiceService');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = tenantFilter(req, { type: 'customer' });

  if (req.query.status) filter.status = req.query.status;
  if (req.query.customerId) filter.customerId = req.query.customerId;

  if (req.query.search) {
    filter.$or = [
      { invoiceNumber: { $regex: req.query.search, $options: 'i' } },
      { 'customerSnapshot.name': { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'invoiceId');

  const invoice = await Invoice.findOne(
    tenantFilter(req, { _id: req.params.id, type: 'customer' })
  ).lean();

  if (!invoice) throw ApiError.notFound('INVOICE_NOT_FOUND', 'Invoice not found');
  return ok(res, invoice);
});

const create = asyncHandler(async (req, res) => {
  const invoice = await service.create({
    tenantId: req.tenantId,
    userId: req.user.id,
    payload: req.body,
  });
  return created(res, invoice);
});

const send = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'invoiceId');
  const invoice = await service.send({
    tenantId: req.tenantId,
    userId: req.user.id,
    invoiceId: req.params.id,
  });
  return ok(res, invoice);
});

const recordPayment = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'invoiceId');
  const invoice = await service.recordPayment({
    tenantId: req.tenantId,
    userId: req.user.id,
    invoiceId: req.params.id,
    amount: req.body.amount,
    method: req.body.method,
    reference: req.body.reference,
    note: req.body.note,
  });
  return ok(res, invoice);
});

const cancel = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'invoiceId');
  const invoice = await service.cancel({
    tenantId: req.tenantId,
    userId: req.user.id,
    invoiceId: req.params.id,
    reason: req.body.reason,
  });
  return ok(res, invoice);
});

const summary = asyncHandler(async (req, res) => {
  const result = await Invoice.aggregate([
    { $match: tenantFilter(req, { type: 'customer' }) },
    {
      $group: {
        _id: null,
        total: { $sum: '$total' },
        totalPaid: { $sum: '$amountPaid' },
        totalDue: { $sum: '$amountDue' },
        count: { $sum: 1 },
        draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
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
      draft: 0,
      sent: 0,
      paid: 0,
      overdue: 0,
    }
  );
});

module.exports = { list, get, create, send, recordPayment, cancel, summary };