const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const { tenantFilter } = require('../../utils/tenantScope');
const { ApiError } = require('../../utils/apiError');
const Product = require('../../models/client/Product');
const InventoryMovement = require('../../models/client/InventoryMovement');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = tenantFilter(req, { active: true });

  if (req.query.lowStock === 'true') {
    filter.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
  }

  const [items, total] = await Promise.all([
    Product.find(filter).sort({ stock: 1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const adjust = asyncHandler(async (req, res) => {
  const { productId, qty, reason } = req.body;
  if (!productId || qty === undefined) {
    throw ApiError.badRequest('MISSING_FIELDS', 'productId and qty required');
  }

  assertObjectId(productId, 'productId');

  const product = await Product.findOne(tenantFilter(req, { _id: productId }));
  if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');

  const newStock = product.stock + Number(qty);
  if (newStock < 0) throw ApiError.badRequest('NEGATIVE_STOCK', 'Stock cannot go below zero');

  product.stock = newStock;
  await product.save();

  await InventoryMovement.create({
    tenantId: req.tenantId,
    productId: product._id,
    type: 'adjustment',
    qty: Number(qty),
    reason: reason || 'Manual adjustment',
    refType: 'manual',
    userId: req.user.id,
    balanceAfter: newStock,
  });

  return ok(res, { productId: product._id, stock: newStock });
});

const history = asyncHandler(async (req, res) => {
  assertObjectId(req.params.productId, 'productId');
  const { page, limit, skip } = parsePagination(req.query);

  const filter = tenantFilter(req, { productId: req.params.productId });
  const [items, total] = await Promise.all([
    InventoryMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    InventoryMovement.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

module.exports = { list, adjust, history };