const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, paginated } = require('../../utils/apiResponse');
const { assertObjectId } = require('../../utils/validateObjectId');
const service = require('../../services/notificationService');

const list = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const { items, total } = await service.listForUser(
    req.tenantId,
    req.user.id,
    {
      page,
      limit,
      filter: req.query.filter || 'all',
      search: req.query.search || '',
    }
  );
  return paginated(res, items, page, limit, total);
});

const unread = asyncHandler(async (req, res) => {
  const count = await service.unreadCount(req.tenantId, req.user.id);
  return ok(res, { count });
});

const summary = asyncHandler(async (req, res) => {
  const data = await service.summary(req.tenantId, req.user.id);
  return ok(res, data);
});

const markRead = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'notificationId');
  const doc = await service.markRead(req.tenantId, req.user.id, req.params.id);
  return ok(res, doc);
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await service.markAllRead(req.tenantId, req.user.id);
  return ok(res, result);
});

const snooze = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'notificationId');
  const doc = await service.snooze(req.tenantId, req.user.id, req.params.id);
  return ok(res, doc);
});

const unsnooze = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'notificationId');
  const doc = await service.unsnooze(req.tenantId, req.user.id, req.params.id);
  return ok(res, doc);
});

const archive = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'notificationId');
  const doc = await service.archive(req.tenantId, req.user.id, req.params.id);
  return ok(res, doc);
});

const remove = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'notificationId');
  const result = await service.remove(req.tenantId, req.user.id, req.params.id);
  return ok(res, result);
});

const clearRead = asyncHandler(async (req, res) => {
  const result = await service.clearRead(req.tenantId, req.user.id);
  return ok(res, result);
});

module.exports = {
  list,
  unread,
  summary,
  markRead,
  markAllRead,
  snooze,
  unsnooze,
  archive,
  remove,
  clearRead,
};