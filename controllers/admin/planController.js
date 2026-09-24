const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, noContent } = require('../../utils/apiResponse');
const { assertObjectId } = require('../../utils/validateObjectId');
const { ApiError } = require('../../utils/apiError');
const Plan = require('../../models/admin/Plan');
const Tenant = require('../../models/admin/Tenant');
const planService = require('../../services/planService');

const list = asyncHandler(async (_req, res) => {
  const plans = await Plan.find().sort({ sortOrder: 1, code: 1 }).lean();
  return ok(res, plans);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'planId');
  const plan = await Plan.findById(req.params.id).lean();
  if (!plan) throw ApiError.notFound('PLAN_NOT_FOUND', 'Plan not found');
  return ok(res, plan);
});

const create = asyncHandler(async (req, res) => {
  const { code, name } = req.body;
  if (!code || !name) throw ApiError.badRequest('MISSING_FIELDS', 'code and name required');

  const exists = await Plan.findOne({ code });
  if (exists) throw ApiError.conflict('PLAN_EXISTS', 'Plan code already exists');

  const plan = await Plan.create({
    code,
    name,
    description: req.body.description || '',
    price: req.body.price || { amount: 0, currency: 'KES', interval: 'month' },
    limits: req.body.limits || {},
    features: req.body.features || {},
    isPublic: req.body.isPublic !== false,
    isActive: req.body.isActive !== false,
    sortOrder: req.body.sortOrder || 0,
    trialDays: req.body.trialDays || 0,
    createdBy: req.admin.id,
  });

  return created(res, plan.toObject());
});

const update = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'planId');

  const allowed = [
    'name',
    'description',
    'price',
    'limits',
    'features',
    'isPublic',
    'isActive',
    'sortOrder',
    'trialDays',
  ];
  const patch = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];

  const plan = await Plan.findByIdAndUpdate(req.params.id, patch, { new: true }).lean();
  if (!plan) throw ApiError.notFound('PLAN_NOT_FOUND', 'Plan not found');

  planService.invalidateCache(plan.code);

  return ok(res, plan);
});

const deactivate = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'planId');

  const plan = await Plan.findById(req.params.id);
  if (!plan) throw ApiError.notFound('PLAN_NOT_FOUND', 'Plan not found');

  const inUse = await Tenant.countDocuments({
    planId: plan.code,
    status: { $in: ['active', 'pending_user'] },
  });

  if (inUse > 0) {
    throw ApiError.badRequest(
      'PLAN_IN_USE',
      `Cannot deactivate: ${inUse} tenant(s) still on this plan`
    );
  }

  plan.isActive = false;
  await plan.save();

  planService.invalidateCache(plan.code);

  return ok(res, { deactivated: true });
});

const remove = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'planId');

  const plan = await Plan.findById(req.params.id);
  if (!plan) throw ApiError.notFound('PLAN_NOT_FOUND', 'Plan not found');

  const inUse = await Tenant.countDocuments({ planId: plan.code });
  if (inUse > 0) {
    throw ApiError.badRequest(
      'PLAN_IN_USE',
      `Cannot delete: ${inUse} tenant(s) are on this plan`
    );
  }

  await plan.deleteOne();

  planService.invalidateCache(plan.code);

  return noContent(res);
});

module.exports = { list, get, create, update, deactivate, remove };