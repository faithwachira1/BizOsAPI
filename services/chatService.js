const { chat } = require('./aiService');
const DailyMetric = require('../models/client/DailyMetric');
const Product = require('../models/client/Product');
const Sale = require('../models/client/Sale');
const Tenant = require('../models/admin/Tenant');
const AiConversation = require('../models/client/AiConversation');
const { ApiError } = require('../utils/apiError');

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function buildContext(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('name country businessType').lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  const from = new Date();
  from.setDate(from.getDate() - 7);
  from.setHours(0, 0, 0, 0);

  const metrics = await DailyMetric.find({ tenantId, date: { $gte: from } }).lean();
  const lowStock = await Product.find({
    tenantId,
    active: true,
    $expr: { $lte: ['$stock', '$lowStockThreshold'] },
  })
    .select('name stock lowStockThreshold')
    .limit(20)
    .lean();

  const todayStart = startOfDay(new Date());
  const todaySales = await Sale.aggregate([
    { $match: { tenantId, createdAt: { $gte: todayStart }, voided: { $ne: true } } },
    { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
  ]);

  return { tenant, metrics, lowStock, today: todaySales[0] || { total: 0, count: 0 } };
}

function buildSystemPrompt(ctx) {
  const { tenant, metrics, lowStock, today } = ctx;

  const last7 = metrics.reduce(
    (acc, m) => {
      acc.totalSales += m.totalSales || 0;
      acc.totalTx += m.totalTransactions || 0;
      return acc;
    },
    { totalSales: 0, totalTx: 0 }
  );

  const topAll = {};
  for (const m of metrics) {
    for (const p of m.topProducts || []) {
      if (!topAll[p.name]) topAll[p.name] = { name: p.name, qty: 0, revenue: 0 };
      topAll[p.name].qty += p.qty;
      topAll[p.name].revenue += p.revenue;
    }
  }
  const top = Object.values(topAll).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const lines = [];
  lines.push(`You are the AI business assistant for ${tenant.name}, a ${tenant.businessType} business in ${tenant.country}.`);
  lines.push(`Today is ${new Date().toISOString().slice(0, 10)}.`);
  lines.push('');
  lines.push('Today:');
  lines.push(`- Sales: ${today.total.toFixed(2)}`);
  lines.push(`- Transactions: ${today.count}`);
  lines.push('');
  lines.push('Last 7 days:');
  lines.push(`- Total sales: ${last7.totalSales.toFixed(2)}`);
  lines.push(`- Transactions: ${last7.totalTx}`);
  if (top.length) {
    lines.push('- Top products:');
    for (const p of top) lines.push(`  · ${p.name} — ${p.qty} sold, ${p.revenue.toFixed(2)} revenue`);
  }
  if (lowStock.length) {
    lines.push('');
    lines.push('Low stock:');
    for (const p of lowStock) lines.push(`  · ${p.name} — ${p.stock} left`);
  }
  lines.push('');
  lines.push('Answer questions about this business only. Use only the numbers above. If asked about something not in the data, say you do not have that information. Never invent numbers. Be concise.');

  return lines.join('\n');
}

async function reply({ tenantId, userId, text }) {
  if (!text || !text.trim()) throw ApiError.badRequest('EMPTY_MESSAGE', 'Message is required');

  const ctx = await buildContext(tenantId);
  const systemPrompt = buildSystemPrompt(ctx);

  const { reply: answer, tokensUsed } = await chat(text, systemPrompt, {
    tenantId,
    type: 'chat',
  });

  await AiConversation.findOneAndUpdate(
    { tenantId, userId },
    {
      $push: {
        messages: {
          $each: [
            { role: 'user', content: text, ts: new Date() },
            { role: 'assistant', content: answer, ts: new Date() },
          ],
        },
      },
    },
    { upsert: true, new: true }
  );

  return { reply: answer, tokensUsed };
}

async function history(tenantId, userId, { limit = 50 } = {}) {
  const doc = await AiConversation.findOne({ tenantId, userId }).lean();
  if (!doc) return [];
  return (doc.messages || []).slice(-limit);
}

async function clear(tenantId, userId) {
  await AiConversation.deleteOne({ tenantId, userId });
  return { cleared: true };
}

module.exports = { reply, history, clear, buildContext, buildSystemPrompt };