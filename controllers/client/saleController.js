const mongoose = require('mongoose');
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
const Tenant = require('../../models/admin/Tenant');
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
    loyaltyDiscountValue = loyaltyService.valueOf(loyaltyPointsRedeemed, cfg);
  }

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

  const tenant = await Tenant.findById(req.tenantId).select('settings').lean();
  const rawTaxRate = Number(tenant?.settings?.taxRate ?? 0);
  const taxRate = Number.isFinite(rawTaxRate) && rawTaxRate > 0 ? rawTaxRate : 0;
  const taxInclusive = tenant?.settings?.taxInclusive === true;

  let tax = 0;
  let total = subtotal - discount;

  if (taxRate > 0) {
    if (taxInclusive) {
      const gross = Math.max(0, subtotal - discount);
      tax = Math.round(gross * (taxRate / (100 + taxRate)));
      total = gross;
    } else {
      tax = Math.round((subtotal - discount) * (taxRate / 100));
      total = subtotal - discount + tax;
    }
  }

  total = Math.max(0, total - loyaltyDiscountValue);

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

  if (req.user.role === 'cashier') {
    filter.cashierId = new mongoose.Types.ObjectId(req.user.id);
  }
  if (req.query.cashierId && req.user.role !== 'cashier') {
    filter.cashierId = new mongoose.Types.ObjectId(req.query.cashierId);
  }
  if (req.query.paymentMethod) filter.paymentMethod = req.query.paymentMethod;

  const [items, total] = await Promise.all([
    Sale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Sale.countDocuments(filter),
  ]);

  return paginated(res, items, page, limit, total);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'saleId');

  const match = tenantFilter(req, {
    _id: new mongoose.Types.ObjectId(req.params.id),
  });
  if (req.user.role === 'cashier') {
    match.cashierId = new mongoose.Types.ObjectId(req.user.id);
  }

  const rows = await Sale.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'customers',
        localField: 'customerId',
        foreignField: '_id',
        as: 'customer',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'cashierId',
        foreignField: '_id',
        as: 'cashier',
      },
    },
    {
      $addFields: {
        customer: {
          $cond: [
            { $gt: [{ $size: '$customer' }, 0] },
            {
              _id: { $arrayElemAt: ['$customer._id', 0] },
              name: { $arrayElemAt: ['$customer.name', 0] },
              phone: { $arrayElemAt: ['$customer.phone', 0] },
              email: { $arrayElemAt: ['$customer.email', 0] },
            },
            null,
          ],
        },
        cashier: {
          $cond: [
            { $gt: [{ $size: '$cashier' }, 0] },
            {
              _id: { $arrayElemAt: ['$cashier._id', 0] },
              fullName: { $arrayElemAt: ['$cashier.fullName', 0] },
              email: { $arrayElemAt: ['$cashier.email', 0] },
              role: { $arrayElemAt: ['$cashier.role', 0] },
            },
            null,
          ],
        },
      },
    },
    { $limit: 1 },
  ]);

  const sale = rows[0];
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