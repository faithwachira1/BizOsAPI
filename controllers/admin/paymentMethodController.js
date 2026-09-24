const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { assertObjectId } = require('../../utils/validateObjectId');
const { ApiError } = require('../../utils/apiError');
const PaymentMethod = require('../../models/admin/PaymentMethod');

const list = asyncHandler(async (_req, res) => {
  const methods = await PaymentMethod.find().sort({ order: 1 }).lean();
  return ok(res, methods);
});

const update = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'methodId');

  const allowed = ['label', 'enabled', 'requiresApproval', 'config', 'order'];
  const patch = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];

  if (patch.config) {
    const masked = {};
    for (const [key, value] of Object.entries(patch.config)) {
      if (/secret|key|pass/i.test(key) && typeof value === 'string' && value.length > 8) {
        masked[key] = `***${value.slice(-4)}`;
      } else {
        masked[key] = value;
      }
    }
    patch.config = masked;
  }

  const method = await PaymentMethod.findByIdAndUpdate(req.params.id, patch, { new: true }).lean();
  if (!method) throw ApiError.notFound('METHOD_NOT_FOUND', 'Payment method not found');
  return ok(res, method);
});

module.exports = { list, update };