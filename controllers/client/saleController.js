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
const loyaltyService = require('../../services/loyaltyService');
const { logger } = require('../../utils/logger');

function generateSaleNumber() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `S-${stamp}-${rand}`;
}

const create = asyncHandler(async (req, res) => {
  const {
    items,
    paymentMethod,
    customerId,
    discount = 0,
    loyaltyPointsRedeemed = 0,
  } = req.body;

  if (!Array.isArray(items) || !items.length) {
    throw ApiError.badRequest('NO_ITEMS', 'Sale must have items');
  }

  await planService.checkTransactionLimit(req.tenantId, Sale);

  // ---------- loyalty redemption prep ----------
  let loyaltyDiscountValue = 0;
  let redeemResult = null;

  if (loyaltyPointsRedeemed > 0) {
    if (!customerId) {
      throw ApiError.badRequest(
        'CUSTOMER_REQUIRED_FOR_REDEEM',
        'Customer required to redeem points'
      );
    }
    const cfg = await loyaltyService.getConfig(req.tenantId);
    if (!cfg.loyaltyEnabled) {
      throw ApiError.badRequest('LOYALTY_DISABLED', 'Loyalty is not enabled');
    }
    loyaltyDiscountValue = loyaltyService.valueOf(
      loyaltyPointsRedeemed,
      cfg
    );
  }

  // ---------- validate products & build line items ----------
  const productIds = items.map((i) => i.productId);
  const products = await Product.find(
    tenantFilter(req, { _id: { $in: productIds } })
  ).lean();
  const productsById = Object.fromEntries(
    products.map((p) => [p._id.toString(), p])
  );

  let subtotal = 0;
  const saleItems = [];

  for (const item of items) {
    const product = productsById[String(item.productId)];
    if (!product) {
      throw ApiError.badRequest(
        'PRODUCT_NOT_FOUND',
        `Product ${item.productId} not found`
      );
    }
    if (product.stock < item.qty) {
      throw ApiError.badRequest(
        'INSUFFICIENT_STOCK',
        `Not enough stock for ${product.name}`
      );
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
  const totalBeforeLoyalty = subtotal - discount + tax;
  const total = Math.max(0, totalBeforeLoyalty - loyaltyDiscountValue);

  // ---------- create sale ----------
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
    loyaltyPointsRedeemed: loyaltyPointsRedeemed || 0,
    loyaltyDiscountValue,
  });

  // ---------- deduct stock ----------
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

  // ---------- customer spend tracking ----------
  if (customerId) {
    await Customer.updateOne(
      tenantFilter(req, { _id: customerId }),
      { $inc: { totalSpent: total }, $set: { lastPurchaseAt: new Date() } }
    );
  }

  // ---------- loyalty redemption commit ----------
  if (loyaltyPointsRedeemed > 0 && customerId) {
    try {
      redeemResult = await loyaltyService.applyChange({
        tenantId: req.tenantId,
        customerId,
        points: -Math.abs(loyaltyPointsRedeemed),
        type: 'redeem',
        reason: `Redeemed on sale ${sale.saleNumber}`,
        refType: 'sale',
        refId: sale._id,
        userId: req.user.id,
      });
    } catch (err) {
      // Redeem failed (e.g. balance shrank) — void the sale to keep things consistent
      logger.error(
        { err: err.message, saleId: sale._id },
        'loyalty redeem failed; voiding sale'
      );
      sale.voided = true;
      sale.voidReason = 'Loyalty redemption failed';
      sale.voidedBy = req.user.id;
      sale.voidedAt = new Date();
      await sale.save();
      throw ApiError.badRequest(
        'REDEEM_FAILED',
        err.message || 'Loyalty redemption failed'
      );
    }
  }

  // ---------- loyalty earn (non-blocking) ----------
  if (customerId) {
    try {
      await loyaltyService.earnFromSale({
        tenantId: req.tenantId,
        customerId,
        total,
        saleId: sale._id,
        userId: req.user.id,
      });
    } catch (err) {
      logger.error(
        { err: err.message, saleId: sale._id },
        'loyalty earn failed (sale still succeeded)'
      );
    }
  }

  return created(res, {
    ...sale.toObject(),
    loyalty: {
      pointsRedeemed: loyaltyPointsRedeemed || 0,
      discountValue: loyaltyDiscountValue,
      balanceAfterRedeem: redeemResult?.points ?? null,
    },
  });
});

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = tenantFilter(req);

  const { start, end } = resolveDateRange(req.query);
  filter.createdAt = { $gte: start, $lte: end };

  if (req.user.role === 'cashier') filter.cashierId = req.user.id;
  if (req.query.cashierId && req.user.role !== 'cashier')
    filter.cashierId = req.query.cashierId;
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
  if (sale.voided)
    throw ApiError.badRequest('ALREADY_VOIDED', 'Sale already voided');

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

  // Reverse loyalty: subtract any earned points, refund any redeemed points
  if (sale.customerId) {
    try {
      if (sale.loyaltyPointsEarned > 0) {
        await loyaltyService.applyChange({
          tenantId: req.tenantId,
          customerId: sale.customerId,
          points: -Math.abs(sale.loyaltyPointsEarned),
          type: 'refund',
          reason: `Sale voided (${sale.saleNumber})`,
          refType: 'sale',
          refId: sale._id,
          userId: req.user.id,
        });
      }
      if (sale.loyaltyPointsRedeemed > 0) {
        await loyaltyService.applyChange({
          tenantId: req.tenantId,
          customerId: sale.customerId,
          points: Math.abs(sale.loyaltyPointsRedeemed),
          type: 'refund',
          reason: `Redemption reversed (${sale.saleNumber})`,
          refType: 'sale',
          refId: sale._id,
          userId: req.user.id,
        });
      }
    } catch (err) {
      logger.error(
        { err: err.message, saleId: sale._id },
        'loyalty reversal on void failed'
      );
    }
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