const Tenant = require('../models/admin/Tenant');
const DailyMetric = require('../models/client/DailyMetric');
const Product = require('../models/client/Product');
const { chat } = require('../services/aiService');
const { getRedis } = require('../config/redis');
const { logger } = require('../utils/logger');

function buildPrompt({ tenant, metrics, lowStock }) {
  const lines = [];
  lines.push(`You are a business analyst for ${tenant.name}, a ${tenant.businessType} business in ${tenant.country}.`);
  lines.push(`Today is ${new Date().toISOString().slice(0, 10)}.`);
  lines.push('');
  lines.push('Last 7 days:');

  let totalSales = 0;
  let totalTx = 0;
  for (const m of metrics) {
    totalSales += m.totalSales || 0;
    totalTx += m.totalTransactions || 0;
  }

  lines.push(`- Total sales: ${totalSales.toFixed(2)}`);
  lines.push(`- Transactions: ${totalTx}`);
  lines.push(`- Average basket: ${totalTx ? (totalSales / totalTx).toFixed(2) : 0}`);

  const topAll = {};
  for (const m of metrics) {
    for (const p of m.topProducts || []) {
      const key = p.name;
      if (!topAll[key]) topAll[key] = { name: p.name, qty: 0, revenue: 0 };
      topAll[key].qty += p.qty;
      topAll[key].revenue += p.revenue;
    }
  }
  const top = Object.values(topAll).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  if (top.length) {
    lines.push('- Top products:');
    for (const p of top) lines.push(`  · ${p.name} — ${p.qty} sold, ${p.revenue.toFixed(2)} revenue`);
  }

  if (lowStock.length) {
    lines.push('');
    lines.push('Low stock:');
    for (const p of lowStock) lines.push(`  · ${p.name} — ${p.stock} left (threshold ${p.lowStockThreshold})`);
  }

  lines.push('');
  lines.push('Respond with 3–5 short bullet points summarizing how the business is doing and what to watch. No intro, no outro. Only the bullets.');

  return lines.join('\n');
}

async function runAiInsights() {
  const tenants = await Tenant.find({ status: 'active' }).select('_id name country businessType').lean();
  const redis = getRedis();

  const from = new Date();
  from.setDate(from.getDate() - 7);
  from.setHours(0, 0, 0, 0);

  for (const tenant of tenants) {
    try {
      const metrics = await DailyMetric.find({
        tenantId: tenant._id,
        date: { $gte: from },
      }).lean();

      if (!metrics.length) continue;

      const lowStock = await Product.find({
        tenantId: tenant._id,
        active: true,
        $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      })
        .select('name stock lowStockThreshold')
        .limit(20)
        .lean();

      const systemPrompt = buildPrompt({ tenant, metrics, lowStock });
      const { reply, tokensUsed } = await chat('Summarize how the business is doing.', systemPrompt);

      if (redis) {
        await redis.set(
          `tenant:${tenant._id}:insights:today`,
          JSON.stringify({ summary: reply, generatedAt: new Date().toISOString() }),
          'EX',
          86400
        );
      }

      logger.info({ tenantId: tenant._id, tokensUsed }, 'aiInsights generated');
    } catch (err) {
      logger.error({ tenantId: tenant._id, err: err.message }, 'aiInsights tenant failed');
    }
  }
}

module.exports = { runAiInsights };