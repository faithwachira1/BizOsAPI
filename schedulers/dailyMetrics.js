const Tenant = require('../models/admin/Tenant');
const Sale = require('../models/client/Sale');
const DailyMetric = require('../models/client/DailyMetric');
const { getRedis } = require('../config/redis');
const { logger } = require('../utils/logger');

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function runDailyMetrics() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = startOfDay(yesterday);
  const from = startOfDay(yesterday);
  const to = endOfDay(yesterday);

  const tenants = await Tenant.find({ status: 'active' }).select('_id').lean();
  const redis = getRedis();

  for (const { _id: tenantId } of tenants) {
    try {
      const sales = await Sale.find({
        tenantId,
        createdAt: { $gte: from, $lte: to },
        voided: { $ne: true },
      }).lean();

      const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
      const totalTransactions = sales.length;
      const avgBasket = totalTransactions ? totalSales / totalTransactions : 0;

      const productCount = {};
      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: 0 }));
      const paymentSplit = {};

      for (const sale of sales) {
        for (const item of sale.items || []) {
          const key = String(item.productId || item.name);
          if (!productCount[key]) {
            productCount[key] = { productId: item.productId || null, name: item.name, qty: 0, revenue: 0 };
          }
          productCount[key].qty += item.qty;
          productCount[key].revenue += item.subtotal;
        }

        const hour = new Date(sale.createdAt).getHours();
        hourly[hour].sales += sale.total;

        const method = sale.paymentMethod || 'unknown';
        paymentSplit[method] = (paymentSplit[method] || 0) + sale.total;
      }

      const topProducts = Object.values(productCount)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      await DailyMetric.findOneAndUpdate(
        { tenantId, date },
        {
          tenantId,
          date,
          totalSales,
          totalTransactions,
          avgBasket,
          topProducts,
          hourlyBreakdown: hourly,
          paymentSplit,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (redis) {
        await redis.del(`tenant:${tenantId}:metrics:${date.toISOString().slice(0, 10)}`);
      }
    } catch (err) {
      logger.error({ tenantId, err: err.message }, 'dailyMetrics tenant failed');
    }
  }
}

module.exports = { runDailyMetrics };