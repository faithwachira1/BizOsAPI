const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, paginated, noContent } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const { tenantFilter } = require('../../utils/tenantScope');
const { ApiError } = require('../../utils/apiError');
const Product = require('../../models/client/Product');
const InventoryMovement = require('../../models/client/InventoryMovement');
const cloudinaryService = require('../../services/cloudinaryService');
const planService = require('../../services/planService');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = tenantFilter(req);
  if (req.query.active !== undefined) filter.active = req.query.active === 'true';
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) filter.name = { $regex: req.query.search, $options: 'i' };

  const [items, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'productId');
  const product = await Product.findOne(tenantFilter(req, { _id: req.params.id })).lean();
  if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');
  return ok(res, product);
});

const create = asyncHandler(async (req, res) => {
  const { name, price } = req.body;
  if (!name || price === undefined) {
    throw ApiError.badRequest('MISSING_FIELDS', 'name and price required');
  }

  await planService.checkProductLimit(req.tenantId, Product);

  const product = await Product.create({
    tenantId: req.tenantId,
    name,
    sku: req.body.sku,
    barcode: req.body.barcode,
    category: req.body.category,
    price,
    cost: req.body.cost || 0,
    stock: req.body.stock || 0,
    lowStockThreshold: req.body.lowStockThreshold || 5,
    imageUrl: req.body.imageUrl,
    imagePublicId: req.body.imagePublicId,
    active: req.body.active !== false,
    createdBy: req.user.id,
  });

  if (product.stock > 0) {
    await InventoryMovement.create({
      tenantId: req.tenantId,
      productId: product._id,
      type: 'in',
      qty: product.stock,
      reason: 'Initial stock',
      refType: 'manual',
      userId: req.user.id,
      balanceAfter: product.stock,
    });
  }

  return created(res, product.toObject());
});

const update = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'productId');

  const allowed = [
    'name',
    'sku',
    'barcode',
    'category',
    'price',
    'cost',
    'lowStockThreshold',
    'imageUrl',
    'imagePublicId',
    'active',
  ];
  const patch = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];

  const product = await Product.findOneAndUpdate(
    tenantFilter(req, { _id: req.params.id }),
    patch,
    { new: true }
  ).lean();

  if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');
  return ok(res, product);
});

const remove = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'productId');

  const product = await Product.findOneAndUpdate(
    tenantFilter(req, { _id: req.params.id }),
    { $set: { active: false } },
    { new: true }
  ).lean();

  if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');
  return noContent(res);
});

const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('NO_FILE', 'File required');

  const folder = cloudinaryService.buildFolder(req.tenantId, 'products');
  const result = await cloudinaryService.uploadBuffer(req.file.buffer, {
    folder,
    resourceType: 'image',
  });

  return ok(res, { url: result.url, publicId: result.publicId });
});

module.exports = { list, get, create, update, remove, uploadImage };