const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { resolveDateRange } = require('../../utils/dateRange');
const { tenantFilter } = require('../../utils/tenantScope');
const cacheService = require('../../services/cacheService');
const chatService = require('../../services/chatService');
const planService = require('../../services/planService');
const DailyMetric = require('../../models/client/DailyMetric');
const Product = require('../../models/client/Product');
const AiUsageLog = require('../../models/admin/AiUsageLog');

const today = asyncHandler(async (req, res) => {
  await planService.assertFeature(req.tenantId, 'aiInsights');

  const cached = await cacheService.getJson(
    cacheService.tenantKey(req.tenantId, 'insights', 'today')
  );
  if (cached) return ok(res, cached);

  const [latest, lowStock] = await Promise.all([
    DailyMetric.findOne({ tenantId: req.tenantId }).sort({ date: -1 }).lean(),
    Product.find(
      tenantFilter(req, {
        active: true,
        $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      })
    )
      .select('name stock lowStockThreshold')
      .limit(20)
      .lean(),
  ]);

  return ok(res, { latestMetric: latest || null, lowStock });
});

const range = asyncHandler(async (req, res) => {
  await planService.assertFeature(req.tenantId, 'aiInsights');

  const { start, end } = resolveDateRange(req.query);

  const metrics = await DailyMetric.find({
    tenantId: req.tenantId,
    date: { $gte: start, $lte: end },
  })
    .sort({ date: 1 })
    .lean();

  return ok(res, metrics);
});

const chat = asyncHandler(async (req, res) => {
  await planService.assertFeature(req.tenantId, 'aiInsights');
  await planService.checkAiQuota(req.tenantId, AiUsageLog);

  const result = await chatService.reply({
    tenantId: req.tenantId,
    userId: req.user.id,
    text: req.body.text,
  });
  return ok(res, result);
});

const stockAlerts = asyncHandler(async (req, res) => {
  const products = await Product.find(
    tenantFilter(req, {
      active: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    })
  )
    .select('name stock lowStockThreshold')
    .sort({ stock: 1 })
    .lean();

  return ok(res, products);
});

module.exports = { today, range, chat, stockAlerts };