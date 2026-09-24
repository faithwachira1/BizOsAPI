const { asyncHandler } = require('../../utils/asyncHandler');
const { paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const AdminAction = require('../../models/admin/AdminAction');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.adminId) filter.adminId = req.query.adminId;
  if (req.query.action) filter.action = { $regex: req.query.action, $options: 'i' };

  const [items, total] = await Promise.all([
    AdminAction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdminAction.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const byTenant = asyncHandler(async (req, res) => {
  assertObjectId(req.params.tenantId, 'tenantId');
  const { page, limit, skip } = parsePagination(req.query);

  const filter = { tenantId: req.params.tenantId };
  const [items, total] = await Promise.all([
    AdminAction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdminAction.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

module.exports = { list, byTenant };