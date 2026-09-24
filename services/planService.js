const Tenant = require('../models/admin/Tenant');
const Plan = require('../models/admin/Plan');
const { ApiError } = require('../utils/apiError');

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000;

async function getPlan(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('planId').lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');

  const code = tenant.planId || 'free';
  const cached = CACHE.get(code);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.plan;

  const plan = await Plan.findOne({ code }).lean();
  if (!plan) throw ApiError.internal('PLAN_MISSING', `Plan '${code}' not configured`);

  CACHE.set(code, { plan, at: Date.now() });
  return plan;
}

function invalidateCache(code) {
  if (code) CACHE.delete(code);
  else CACHE.clear();
}

async function checkOwnerLimit(tenantId, Model) {
  const plan = await getPlan(tenantId);
  const count = await Model.countDocuments({ tenantId, role: 'owner', status: 'active' });
  if (count >= plan.limits.maxOwners) {
    throw ApiError.badRequest(
      'LIMIT_OWNERS',
      `Plan '${plan.name}' allows ${plan.limits.maxOwners} owner(s)`
    );
  }
}

async function checkManagerLimit(tenantId, Model) {
  const plan = await getPlan(tenantId);
  const count = await Model.countDocuments({ tenantId, role: 'manager', status: 'active' });
  if (count >= plan.limits.maxManagers) {
    throw ApiError.badRequest(
      'LIMIT_MANAGERS',
      `Plan '${plan.name}' allows ${plan.limits.maxManagers} manager(s)`
    );
  }
}

async function checkCashierLimit(tenantId, Model) {
  const plan = await getPlan(tenantId);
  const count = await Model.countDocuments({ tenantId, role: 'cashier', status: 'active' });
  if (count >= plan.limits.maxCashiers) {
    throw ApiError.badRequest(
      'LIMIT_CASHIERS',
      `Plan '${plan.name}' allows ${plan.limits.maxCashiers} cashier(s)`
    );
  }
}

async function checkProductLimit(tenantId, Product) {
  const plan = await getPlan(tenantId);
  const count = await Product.countDocuments({ tenantId, active: true });
  if (count >= plan.limits.maxProducts) {
    throw ApiError.badRequest(
      'LIMIT_PRODUCTS',
      `Plan '${plan.name}' allows ${plan.limits.maxProducts} products`
    );
  }
}

async function checkTransactionLimit(tenantId, Sale) {
  const plan = await getPlan(tenantId);
  if (!plan.limits.maxTransactionsPerMonth) return;

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const count = await Sale.countDocuments({
    tenantId,
    createdAt: { $gte: start },
    voided: { $ne: true },
  });

  if (count >= plan.limits.maxTransactionsPerMonth) {
    throw ApiError.badRequest(
      'LIMIT_TRANSACTIONS',
      `Plan '${plan.name}' allows ${plan.limits.maxTransactionsPerMonth} transactions per month`
    );
  }
}

async function checkAiQuota(tenantId, AiUsageLog) {
  const plan = await getPlan(tenantId);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const count = await AiUsageLog.countDocuments({
    tenantId,
    createdAt: { $gte: start },
  });

  if (count >= plan.limits.maxAiCallsPerDay) {
    throw ApiError.badRequest(
      'LIMIT_AI',
      `Plan '${plan.name}' allows ${plan.limits.maxAiCallsPerDay} AI calls per day`
    );
  }
}

async function hasFeature(tenantId, feature) {
  const plan = await getPlan(tenantId);
  return plan.features[feature] === true;
}

async function assertFeature(tenantId, feature) {
  const ok = await hasFeature(tenantId, feature);
  if (!ok) {
    const plan = await getPlan(tenantId);
    throw ApiError.forbidden(
      'FEATURE_DISABLED',
      `${feature} is not available on plan '${plan.name}'`
    );
  }
}

module.exports = {
  getPlan,
  invalidateCache,
  checkOwnerLimit,
  checkManagerLimit,
  checkCashierLimit,
  checkProductLimit,
  checkTransactionLimit,
  checkAiQuota,
  hasFeature,
  assertFeature,
};