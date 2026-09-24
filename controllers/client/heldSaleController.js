const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, noContent } = require('../../utils/apiResponse');
const { assertObjectId } = require('../../utils/validateObjectId');
const { tenantFilter } = require('../../utils/tenantScope');
const { ApiError } = require('../../utils/apiError');
const HeldSale = require('../../models/client/HeldSale');

const TTL_MS = 24 * 60 * 60 * 1000;

const list = asyncHandler(async (req, res) => {
  const items = await HeldSale.find(
    tenantFilter(req, { cashierId: req.user.id })
  )
    .sort({ createdAt: -1 })
    .lean();

  return ok(res, items);
});

const create = asyncHandler(async (req, res) => {
  const { items, label, customerId, discount, note } = req.body;

  if (!Array.isArray(items) || !items.length) {
    throw ApiError.badRequest('NO_ITEMS', 'Held sale must have items');
  }

  const normalized = items.map((i) => ({
    productId: i.productId,
    name: i.name,
    sku: i.sku || null,
    price: Number(i.price) || 0,
    qty: Number(i.qty) || 1,
    stock: Number(i.stock) || 0,
    unit: i.unit || null,
  }));

  const held = await HeldSale.create({
    tenantId: req.tenantId,
    cashierId: req.user.id,
    label: (label || 'Walk-in').toString().slice(0, 80),
    customerId: customerId || null,
    items: normalized,
    discount: discount || '',
    note: (note || '').toString().slice(0, 500),
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  return created(res, held.toObject());
});

const resume = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'heldSaleId');

  const held = await HeldSale.findOne(
    tenantFilter(req, { _id: req.params.id, cashierId: req.user.id })
  );

  if (!held) throw ApiError.notFound('HELD_NOT_FOUND', 'Held sale not found');
  if (held.expiresAt < new Date()) {
    await held.deleteOne();
    throw ApiError.badRequest('HELD_EXPIRED', 'Held sale has expired');
  }

  held.resumedAt = new Date();
  await held.save();

  return ok(res, held.toObject());
});

const remove = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'heldSaleId');
  await HeldSale.deleteOne(
    tenantFilter(req, { _id: req.params.id, cashierId: req.user.id })
  );
  return noContent(res);
});

module.exports = { list, create, resume, remove };