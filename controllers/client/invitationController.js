const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, paginated, noContent } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const { tenantFilter } = require('../../utils/tenantScope');
const { ApiError } = require('../../utils/apiError');
const UserInvitation = require('../../models/client/UserInvitation');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = tenantFilter(req, { acceptedAt: null });

  const [items, total] = await Promise.all([
    UserInvitation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserInvitation.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const resend = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'invitationId');

  const inv = await UserInvitation.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!inv) throw ApiError.notFound('INVITE_NOT_FOUND', 'Invitation not found');

  inv.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await inv.save();

  return ok(res, { resent: true });
});

const cancel = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'invitationId');
  await UserInvitation.deleteOne(tenantFilter(req, { _id: req.params.id }));
  return noContent(res);
});

module.exports = { list, resend, cancel };