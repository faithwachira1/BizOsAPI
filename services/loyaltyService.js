const { ApiError } = require('../utils/apiError');
const Tenant = require('../models/admin/Tenant');
const Customer = require('../models/client/Customer');
const LoyaltyTransaction = require('../models/client/LoyaltyTransaction');

const DEFAULTS = {
  loyaltyEnabled: false,
  loyaltyPointsPerCurrency: 1,
  loyaltyCurrencyUnit: 100,
  loyaltyRedeemRate: 1,
  loyaltyMinRedeem: 100,
};

function settingsOf(tenant) {
  const s = tenant?.settings || {};
  return {
    loyaltyEnabled: s.loyaltyEnabled ?? DEFAULTS.loyaltyEnabled,
    loyaltyPointsPerCurrency:
      s.loyaltyPointsPerCurrency ?? DEFAULTS.loyaltyPointsPerCurrency,
    loyaltyCurrencyUnit: s.loyaltyCurrencyUnit ?? DEFAULTS.loyaltyCurrencyUnit,
    loyaltyRedeemRate: s.loyaltyRedeemRate ?? DEFAULTS.loyaltyRedeemRate,
    loyaltyMinRedeem: s.loyaltyMinRedeem ?? DEFAULTS.loyaltyMinRedeem,
  };
}

function tierFor(points) {
  if (points >= 5000) return 'gold';
  if (points >= 1000) return 'silver';
  if (points >= 100) return 'bronze';
  return 'none';
}

function calculateEarn(total, cfg) {
  if (!cfg.loyaltyEnabled) return 0;
  if (!cfg.loyaltyCurrencyUnit) return 0;
  const units = Math.floor(Number(total) / cfg.loyaltyCurrencyUnit);
  return Math.max(0, units * cfg.loyaltyPointsPerCurrency);
}

function valueOf(points, cfg) {
  return Math.max(0, Number(points) * cfg.loyaltyRedeemRate);
}

async function getConfig(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings').lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');
  return settingsOf(tenant);
}

async function getBalance(tenantId, customerId) {
  const customer = await Customer.findOne({
    _id: customerId,
    tenantId,
  })
    .select('name points loyaltyTier pointsUpdatedAt')
    .lean();

  if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');

  return {
    customerId: customer._id,
    name: customer.name,
    points: customer.points || 0,
    tier: customer.loyaltyTier || 'none',
    updatedAt: customer.pointsUpdatedAt,
  };
}

async function getHistory(tenantId, customerId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const filter = { tenantId, customerId };

  const [items, total] = await Promise.all([
    LoyaltyTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LoyaltyTransaction.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

/**
 * Apply a loyalty change atomically. Positive points = earn/adjust-up, negative = redeem/adjust-down.
 */
async function applyChange({
  tenantId,
  customerId,
  points,
  type,
  reason = null,
  refType = null,
  refId = null,
  userId = null,
}) {
  if (!Number.isFinite(points) || points === 0) {
    throw ApiError.badRequest('INVALID_POINTS', 'Points must be a non-zero number');
  }

  const customer = await Customer.findOne({ _id: customerId, tenantId });
  if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');

  const next = (customer.points || 0) + points;
  if (next < 0) {
    throw ApiError.badRequest(
      'INSUFFICIENT_POINTS',
      `Customer has ${customer.points || 0} points; cannot deduct ${Math.abs(points)}`
    );
  }

  customer.points = next;
  customer.pointsUpdatedAt = new Date();
  customer.loyaltyTier = tierFor(next);
  await customer.save();

  const tx = await LoyaltyTransaction.create({
    tenantId,
    customerId: customer._id,
    type,
    points,
    balanceAfter: next,
    reason,
    refType,
    refId,
    userId,
  });

  return {
    points: next,
    tier: customer.loyaltyTier,
    transaction: tx.toObject(),
  };
}

async function earnFromSale({ tenantId, customerId, total, saleId, userId }) {
  const cfg = await getConfig(tenantId);
  if (!cfg.loyaltyEnabled || !customerId) return null;

  const points = calculateEarn(total, cfg);
  if (points <= 0) return null;

  return applyChange({
    tenantId,
    customerId,
    points,
    type: 'earn',
    reason: `Points earned on sale`,
    refType: 'sale',
    refId: saleId,
    userId,
  });
}

async function redeem({
  tenantId,
  customerId,
  points,
  reason = 'Manual redemption',
  userId = null,
}) {
  const cfg = await getConfig(tenantId);
  if (!cfg.loyaltyEnabled) {
    throw ApiError.badRequest('LOYALTY_DISABLED', 'Loyalty is not enabled');
  }
  if (points < cfg.loyaltyMinRedeem) {
    throw ApiError.badRequest(
      'BELOW_MIN_REDEEM',
      `Minimum redeem is ${cfg.loyaltyMinRedeem} points`
    );
  }

  const result = await applyChange({
    tenantId,
    customerId,
    points: -Math.abs(points),
    type: 'redeem',
    reason,
    refType: 'redemption',
    userId,
  });

  return {
    ...result,
    value: valueOf(points, cfg),
    currency: (await Tenant.findById(tenantId).select('settings.currency').lean())
      ?.settings?.currency || 'KES',
  };
}

async function adjust({
  tenantId,
  customerId,
  points,
  reason = 'Manual adjustment',
  userId = null,
}) {
  return applyChange({
    tenantId,
    customerId,
    points,
    type: 'adjust',
    reason,
    refType: 'manual',
    userId,
  });
}

module.exports = {
  DEFAULTS,
  settingsOf,
  tierFor,
  calculateEarn,
  valueOf,
  getConfig,
  getBalance,
  getHistory,
  applyChange,
  earnFromSale,
  redeem,
  adjust,
};