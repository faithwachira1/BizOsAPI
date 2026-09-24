const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const service = require('../../services/purchaseOrderService');

const list = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { items, total } = await service.list(req.tenantId, {
    page,
    limit,
    status: req.query.status,
    supplierId: req.query.supplierId,
    search: req.query.search,
  });
  return paginated(res, items, page, limit, total);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'poId');
  const po = await service.getById(req.tenantId, req.params.id);
  return ok(res, po);
});

const create = asyncHandler(async (req, res) => {
  const po = await service.create(req.tenantId, req.user.id, req.body);
  return created(res, po);
});

const update = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'poId');
  const po = await service.update(req.tenantId, req.params.id, req.body);
  return ok(res, po);
});

const send = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'poId');
  const po = await service.send(req.tenantId, req.params.id);
  return ok(res, po);
});

const receive = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'poId');
  const po = await service.receive(req.tenantId, req.user.id, req.params.id, req.body);
  return ok(res, po);
});

const cancel = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'poId');
  const po = await service.cancel(req.tenantId, req.params.id, req.body.reason);
  return ok(res, po);
});

const pdf = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'poId');
  const po = await service.getById(req.tenantId, req.params.id);
  return ok(res, { url: po.pdfUrl || null, po });
});

module.exports = { list, get, create, update, send, receive, cancel, pdf };