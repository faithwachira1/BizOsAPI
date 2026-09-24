const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const supplierService = require('../../services/supplierService');

const list = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { search, active } = req.query;

  const activeFilter =
    active === undefined ? undefined : active === 'true';

  const { items, total } = await supplierService.list(req.tenantId, {
    page,
    limit,
    search,
    active: activeFilter,
  });

  return paginated(res, items, page, limit, total);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'supplierId');
  const supplier = await supplierService.getById(req.tenantId, req.params.id);
  return ok(res, supplier);
});

const create = asyncHandler(async (req, res) => {
  const supplier = await supplierService.create(req.tenantId, req.body);
  return created(res, supplier);
});

const update = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'supplierId');
  const supplier = await supplierService.update(req.tenantId, req.params.id, req.body);
  return ok(res, supplier);
});

const remove = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'supplierId');
  const result = await supplierService.remove(req.tenantId, req.params.id);
  return ok(res, result);
});

const orders = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'supplierId');
  const { page, limit } = parsePagination(req.query);

  const result = await supplierService.orders(req.tenantId, req.params.id, {
    page,
    limit,
  });

  return paginated(res, result.items, page, limit, result.total);
});

module.exports = { list, get, create, update, remove, orders };