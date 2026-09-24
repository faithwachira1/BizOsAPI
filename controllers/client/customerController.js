const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, paginated, noContent } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const { tenantFilter } = require('../../utils/tenantScope');
const { ApiError } = require('../../utils/apiError');
const Customer = require('../../models/client/Customer');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = tenantFilter(req);

  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { phone: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Customer.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'customerId');
  const customer = await Customer.findOne(tenantFilter(req, { _id: req.params.id })).lean();
  if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
  return ok(res, customer);
});

const create = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) throw ApiError.badRequest('NAME_REQUIRED', 'Name required');

  const customer = await Customer.create({
    tenantId: req.tenantId,
    name,
    phone: req.body.phone,
    email: req.body.email,
    address: req.body.address,
    notes: req.body.notes,
  });

  return created(res, customer.toObject());
});

const update = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'customerId');

  const allowed = ['name', 'phone', 'email', 'address', 'notes', 'active'];
  const patch = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];

  const customer = await Customer.findOneAndUpdate(
    tenantFilter(req, { _id: req.params.id }),
    patch,
    { new: true }
  ).lean();

  if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
  return ok(res, customer);
});

const remove = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'customerId');

  const customer = await Customer.findOneAndUpdate(
    tenantFilter(req, { _id: req.params.id }),
    { $set: { active: false } },
    { new: true }
  ).lean();

  if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
  return noContent(res);
});

module.exports = { list, get, create, update, remove };