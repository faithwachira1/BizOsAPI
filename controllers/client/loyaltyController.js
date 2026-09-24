const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, paginated } = require('../../utils/apiResponse');
const { assertObjectId } = require('../../utils/validateObjectId');
const { ApiError } = require('../../utils/apiError');
const loyaltyService = require('../../services/loyaltyService');

const getConfig = asyncHandler(async (req, res) => {
  const cfg = await loyaltyService.getConfig(req.tenantId);
  return ok(res, cfg);
});

const getBalance = asyncHandler(async (req, res) => {
  assertObjectId(req.params.customerId, 'customerId');
  const data = await loyaltyService.getBalance(req.tenantId, req.params.customerId);
  return ok(res, data);
});

const getHistory = asyncHandler(async (req, res) => {
  assertObjectId(req.params.customerId, 'customerId');
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { items, total } = await loyaltyService.getHistory(
    req.tenantId,
    req.params.customerId,
    { page, limit }
  );
  return paginated(res, items, page, limit, total);
});

const adjust = asyncHandler(async (req, res) => {
  assertObjectId(req.params.customerId, 'customerId');
  const { points, reason } = req.body;

  if (points === undefined || points === null) {
    throw ApiError.badRequest('POINTS_REQUIRED', 'points is required');
  }
  const n = Number(points);
  if (!Number.isFinite(n) || n === 0) {
    throw ApiError.badRequest('INVALID_POINTS', 'points must be a non-zero number');
  }

  const result = await loyaltyService.adjust({
    tenantId: req.tenantId,
    customerId: req.params.customerId,
    points: n,
    reason: reason || 'Manual adjustment',
    userId: req.user.id,
  });

  return created(res, result);
});

const redeem = asyncHandler(async (req, res) => {
  assertObjectId(req.params.customerId, 'customerId');
  const { points, reason } = req.body;

  if (points === undefined || points === null) {
    throw ApiError.badRequest('POINTS_REQUIRED', 'points is required');
  }
  const n = Number(points);
  if (!Number.isFinite(n) || n <= 0) {
    throw ApiError.badRequest('INVALID_POINTS', 'points must be a positive number');
  }

  const result = await loyaltyService.redeem({
    tenantId: req.tenantId,
    customerId: req.params.customerId,
    points: n,
    reason: reason || 'Manual redemption',
    userId: req.user.id,
  });

  return created(res, result);
});

module.exports = { getConfig, getBalance, getHistory, adjust, redeem };