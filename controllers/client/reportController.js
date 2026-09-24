const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { tenantFilter } = require('../../utils/tenantScope');
const { resolveDateRange } = require('../../utils/dateRange');
const Sale = require('../../models/client/Sale');

const salesSummary = asyncHandler(async (req, res) => {
  const { start, end } = resolveDateRange(req.query);

  const result = await Sale.aggregate([
    {
      $match: {
        ...tenantFilter(req),
        createdAt: { $gte: start, $lte: end },
        voided: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$total' },
        totalTransactions: { $sum: 1 },
        totalDiscount: { $sum: '$discount' },
        totalTax: { $sum: '$tax' },
      },
    },
  ]);

  return ok(
    res,
    result[0] || {
      totalSales: 0,
      totalTransactions: 0,
      totalDiscount: 0,
      totalTax: 0,
    }
  );
});

const topProducts = asyncHandler(async (req, res) => {
  const { start, end } = resolveDateRange(req.query);
  const limit = Number(req.query.limit) || 10;

  const result = await Sale.aggregate([
    {
      $match: {
        ...tenantFilter(req),
        createdAt: { $gte: start, $lte: end },
        voided: { $ne: true },
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.name' },
        qty: { $sum: '$items.qty' },
        revenue: { $sum: '$items.subtotal' },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]);

  return ok(res, result);
});

const staff = asyncHandler(async (req, res) => {
  const { start, end } = resolveDateRange(req.query);

  const result = await Sale.aggregate([
    {
      $match: {
        ...tenantFilter(req),
        createdAt: { $gte: start, $lte: end },
        voided: { $ne: true },
      },
    },
    {
      $group: {
        _id: '$cashierId',
        totalSales: { $sum: '$total' },
        transactions: { $sum: 1 },
      },
    },
    { $sort: { totalSales: -1 } },
  ]);

  return ok(res, result);
});

const exportData = asyncHandler(async (req, res) => {
  const { start, end } = resolveDateRange(req.query);

  const sales = await Sale.find({
    ...tenantFilter(req),
    createdAt: { $gte: start, $lte: end },
  })
    .sort({ createdAt: -1 })
    .lean();

  const header = 'Sale Number,Date,Total,Payment Method,Status\n';
  const rows = sales
    .map(
      (s) =>
        `${s.saleNumber},${s.createdAt.toISOString()},${s.total},${s.paymentMethod || ''},${s.voided ? 'voided' : 'paid'}`
    )
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sales.csv"');
  return res.send(header + rows);
});

module.exports = { salesSummary, topProducts, staff, exportData };