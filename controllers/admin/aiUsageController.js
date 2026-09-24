const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const AiUsageLog = require('../../models/admin/AiUsageLog');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.tenantId) filter.tenantId = req.query.tenantId;
  if (req.query.type) filter.type = req.query.type;

  const [items, total] = await Promise.all([
    AiUsageLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AiUsageLog.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const summary = asyncHandler(async (req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [byTenant, byType, totals] = await Promise.all([
    AiUsageLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$tenantId', calls: { $sum: 1 }, tokens: { $sum: '$tokensUsed' } } },
      { $sort: { calls: -1 } },
      { $limit: 50 },
    ]),
    AiUsageLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$type', calls: { $sum: 1 }, tokens: { $sum: '$tokensUsed' } } },
    ]),
    AiUsageLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          calls: { $sum: 1 },
          tokens: { $sum: '$tokensUsed' },
          avgLatencyMs: { $avg: '$latencyMs' },
        },
      },
    ]),
  ]);

  return ok(res, {
    since: since.toISOString(),
    totals: totals[0] || { calls: 0, tokens: 0, avgLatencyMs: 0 },
    byTenant,
    byType,
  });
});

module.exports = { list, summary };