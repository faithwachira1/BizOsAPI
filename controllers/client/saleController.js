const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const { tenantFilter } = require('../../utils/tenantScope');
const { resolveDateRange } = require('../../utils/dateRange');
const { ApiError } = require('../../utils/apiError');
const Sale = require('../../models/client/Sale');
const Product = require('../../models/client/Product');
const Customer = require('../../models/client/Customer');
const InventoryMovement = require('../../models/client/InventoryMovement');
const planService = require('../../services/planService');

function generateSaleNumber() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `S-${stamp}-${rand}`;
}

const create = asyncHandler(async (req, res) => {
  const { items, paymentMethod, customerId, discount = 0 } = req.body;
  if (!Array.isArray(items) || !items.length) {
    throw ApiError.badRequest('NO_ITEMS', 'Sale must have items');
  }

  await planService.checkTransactionLimit(req.tenantId, Sale);

  const productIds = items.map((i) => i.productId);
  const products = await Product.find(
    tenantFilter(req, { _id: { $in: productIds } })
  ).lean();
  const productsById = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  let subtotal = 0;
  const saleItems = [];

  for (const item of items) {
    const product = productsById[String(item.productId)];
    if (!product) {
      throw ApiError.badRequest('PRODUCT_NOT_FOUND', `Product ${item.productId} not found`);
    }
    if (product.stock < item.qty) {
      throw ApiError.badRequest('INSUFFICIENT_STOCK', `Not enough stock for ${product.name}`);
    }

    const lineTotal = product.price * item.qty;
    subtotal += lineTotal;

    saleItems.push({
      productId: product._id,
      name: product.name,
      sku: product.sku,
      qty: item.qty,
      price: product.price,
      subtotal: lineTotal,
    });
  }

  const tax = 0;
  const total = subtotal - discount + tax;

  const sale = await Sale.create({
    tenantId: req.tenantId,
    saleNumber: generateSaleNumber(),
    items: saleItems,
    subtotal,
    discount,
    tax,
    total,
    currency: 'KES',
    paymentMethod,
    paymentStatus: 'paid',
    cashierId: req.user.id,
    customerId: customerId || null,
  });

  for (const item of saleItems) {
    const product = productsById[String(item.productId)];
    const newStock = product.stock - item.qty;

    await Product.updateOne({ _id: product._id }, { $set: { stock: newStock } });

    await InventoryMovement.create({
      tenantId: req.tenantId,
      productId: product._id,
      type: 'sale',
      qty: -item.qty,
      refType: 'sale',
      refId: sale._id,
      userId: req.user.id,
      balanceAfter: newStock,
    });
  }

  if (customerId) {
    await Customer.updateOne(
      tenantFilter(req, { _id: customerId }),
      { $inc: { totalSpent: total }, $set: { lastPurchaseAt: new Date() } }
    );
  }

  return created(res, sale.toObject());
});

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = tenantFilter(req);

  const { start, end } = resolveDateRange(req.query);
  filter.createdAt = { $gte: start, $lte: end };

  if (req.user.role === 'cashier') filter.cashierId = req.user.id;
  if (req.query.cashierId && req.user.role !== 'cashier') filter.cashierId = req.query.cashierId;
  if (req.query.paymentMethod) filter.paymentMethod = req.query.paymentMethod;

  const [items, total] = await Promise.all([
    Sale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Sale.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'saleId');

  const filter = tenantFilter(req, { _id: req.params.id });
  if (req.user.role === 'cashier') filter.cashierId = req.user.id;

  const sale = await Sale.findOne(filter).lean();
  if (!sale) throw ApiError.notFound('SALE_NOT_FOUND', 'Sale not found');
  return ok(res, sale);
});

const voidSale = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'saleId');

  const sale = await Sale.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!sale) throw ApiError.notFound('SALE_NOT_FOUND', 'Sale not found');
  if (sale.voided) throw ApiError.badRequest('ALREADY_VOIDED', 'Sale already voided');

  sale.voided = true;
  sale.voidReason = req.body.reason || 'No reason provided';
  sale.voidedBy = req.user.id;
  sale.voidedAt = new Date();
  await sale.save();

  for (const item of sale.items) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    const newStock = product.stock + item.qty;
    await Product.updateOne({ _id: product._id }, { $set: { stock: newStock } });

    await InventoryMovement.create({
      tenantId: req.tenantId,
      productId: product._id,
      type: 'sale_return',
      qty: item.qty,
      reason: 'Sale voided',
      refType: 'sale',
      refId: sale._id,
      userId: req.user.id,
      balanceAfter: newStock,
    });
  }

  return ok(res, sale.toObject());
});

const reprint = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'saleId');
  const sale = await Sale.findOne(tenantFilter(req, { _id: req.params.id })).lean();
  if (!sale) throw ApiError.notFound('SALE_NOT_FOUND', 'Sale not found');
  return ok(res, sale);
});

module.exports = { create, list, get, voidSale, reprint };