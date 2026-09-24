const { ApiError } = require('../utils/apiError');
const Tenant = require('../models/admin/Tenant');
const Supplier = require('../models/client/Supplier');
const Product = require('../models/client/Product');
const PurchaseOrder = require('../models/client/PurchaseOrder');
const InventoryMovement = require('../models/client/InventoryMovement');
const { logger } = require('../utils/logger');

function generatePoNumber() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PO-${stamp}-${rand}`;
}

async function list(tenantId, { page = 1, limit = 20, status, supplierId, search } = {}) {
  const filter = { tenantId };
  if (status) filter.status = status;
  if (supplierId) filter.supplierId = supplierId;
  if (search) {
    filter.$or = [
      { poNumber: { $regex: search, $options: 'i' } },
      { 'supplierSnapshot.name': { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    PurchaseOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PurchaseOrder.countDocuments(filter),
  ]);

  return { items, total };
}

async function getById(tenantId, id) {
  const po = await PurchaseOrder.findOne({ _id: id, tenantId }).lean();
  if (!po) throw ApiError.notFound('PO_NOT_FOUND', 'Purchase order not found');
  return po;
}

async function create(tenantId, userId, payload) {
  const { supplierId, items, shipping = 0, notes, expectedAt } = payload;

  if (!supplierId) throw ApiError.badRequest('SUPPLIER_REQUIRED', 'Supplier is required');
  if (!Array.isArray(items) || !items.length) {
    throw ApiError.badRequest('NO_ITEMS', 'At least one item is required');
  }

  const supplier = await Supplier.findOne({ _id: supplierId, tenantId, active: true }).lean();
  if (!supplier) throw ApiError.notFound('SUPPLIER_NOT_FOUND', 'Supplier not found');

  const tenant = await Tenant.findById(tenantId).select('settings').lean();
  const currency = tenant?.settings?.currency || 'KES';

  const productIds = items.filter((i) => i.productId).map((i) => i.productId);
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, tenantId }).lean()
    : [];
  const byId = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  let subtotal = 0;
  const poItems = [];

  for (const item of items) {
    const qty = Number(item.qty) || 0;
    if (qty <= 0) throw ApiError.badRequest('INVALID_QTY', 'Quantity must be positive');

    let name = item.name;
    let sku = item.sku || null;
    let unitCost = Number(item.unitCost) || 0;
    let productId = null;

    if (item.productId) {
      const product = byId[String(item.productId)];
      if (!product) throw ApiError.badRequest('PRODUCT_NOT_FOUND', 'Product not found');
      productId = product._id;
      name = product.name;
      sku = product.sku || null;
      if (!unitCost) unitCost = product.cost || 0;
    }

    if (!name) throw ApiError.badRequest('ITEM_NAME_REQUIRED', 'Item name required');
    if (unitCost < 0) throw ApiError.badRequest('INVALID_COST', 'Unit cost must be ≥ 0');

    const lineTotal = unitCost * qty;
    subtotal += lineTotal;

    poItems.push({
      productId,
      name,
      sku,
      qty,
      unitCost,
      subtotal: lineTotal,
      receivedQty: 0,
    });
  }

  const tax = 0;
  const total = subtotal + tax + Number(shipping);

  const po = await PurchaseOrder.create({
    tenantId,
    poNumber: generatePoNumber(),
    supplierId: supplier._id,
    supplierSnapshot: {
      name: supplier.name,
      phone: supplier.phone || null,
      email: supplier.email || null,
      address: supplier.address || null,
    },
    items: poItems,
    subtotal,
    tax,
    shipping: Number(shipping),
    total,
    currency,
    status: 'draft',
    notes: notes || null,
    expectedAt: expectedAt ? new Date(expectedAt) : null,
    createdBy: userId,
  });

  logger.info({ tenantId, poId: po._id }, 'purchase order created');

  return po.toObject();
}

async function update(tenantId, id, payload) {
  const po = await PurchaseOrder.findOne({ _id: id, tenantId });
  if (!po) throw ApiError.notFound('PO_NOT_FOUND', 'Purchase order not found');
  if (po.status !== 'draft') {
    throw ApiError.badRequest('NOT_EDITABLE', 'Only draft orders can be edited');
  }

  const { items, shipping, notes, expectedAt } = payload;

  if (items && Array.isArray(items)) {
    let subtotal = 0;
    const poItems = [];

    for (const item of items) {
      const qty = Number(item.qty) || 0;
      if (qty <= 0) throw ApiError.badRequest('INVALID_QTY', 'Quantity must be positive');

      const unitCost = Number(item.unitCost) || 0;
      if (unitCost < 0) throw ApiError.badRequest('INVALID_COST', 'Unit cost must be ≥ 0');

      const lineTotal = unitCost * qty;
      subtotal += lineTotal;

      poItems.push({
        productId: item.productId || null,
        name: item.name,
        sku: item.sku || null,
        qty,
        unitCost,
        subtotal: lineTotal,
        receivedQty: 0,
      });
    }

    po.items = poItems;
    po.subtotal = subtotal;
  }

  if (shipping !== undefined) po.shipping = Number(shipping);
  if (notes !== undefined) po.notes = notes;
  if (expectedAt !== undefined) po.expectedAt = expectedAt ? new Date(expectedAt) : null;

  po.total = po.subtotal + (po.tax || 0) + (po.shipping || 0);

  await po.save();
  return po.toObject();
}

async function send(tenantId, id) {
  const po = await PurchaseOrder.findOne({ _id: id, tenantId });
  if (!po) throw ApiError.notFound('PO_NOT_FOUND', 'Purchase order not found');
  if (po.status !== 'draft') {
    throw ApiError.badRequest('NOT_DRAFT', 'Only draft orders can be sent');
  }

  po.status = 'sent';
  po.sentAt = new Date();
  await po.save();

  return po.toObject();
}

async function receive(tenantId, userId, id, payload) {
  const po = await PurchaseOrder.findOne({ _id: id, tenantId });
  if (!po) throw ApiError.notFound('PO_NOT_FOUND', 'Purchase order not found');
  if (po.status === 'cancelled') {
    throw ApiError.badRequest('CANCELLED', 'Cannot receive a cancelled order');
  }
  if (po.status === 'received') {
    throw ApiError.badRequest('ALREADY_RECEIVED', 'Order already fully received');
  }

  const lines = Array.isArray(payload?.items) ? payload.items : null;

  let anyReceived = false;

  if (lines && lines.length) {
    for (const line of lines) {
      const idx = Number(line.index);
      const qty = Number(line.qty) || 0;
      if (!Number.isInteger(idx) || idx < 0 || idx >= po.items.length) {
        throw ApiError.badRequest('INVALID_INDEX', `Invalid item index ${line.index}`);
      }
      if (qty < 0) throw ApiError.badRequest('INVALID_QTY', 'Received qty must be ≥ 0');

      const item = po.items[idx];
      const remaining = item.qty - item.receivedQty;
      if (qty > remaining) {
        throw ApiError.badRequest(
          'OVER_RECEIVE',
          `Cannot receive ${qty} of ${item.name}; only ${remaining} remaining`
        );
      }
      item.receivedQty += qty;
      if (qty > 0) anyReceived = true;

      if (item.productId && qty > 0) {
        const product = await Product.findOne({ _id: item.productId, tenantId });
        if (product) {
          const newStock = product.stock + qty;
          await Product.updateOne(
            { _id: product._id },
            { $set: { stock: newStock } }
          );
          await InventoryMovement.create({
            tenantId,
            productId: product._id,
            type: 'purchase',
            qty,
            reason: `PO ${po.poNumber} received`,
            refType: 'purchase_order',
            refId: po._id,
            userId,
            balanceAfter: newStock,
          });
        }
      }
    }
  } else {
    for (const item of po.items) {
      const remaining = item.qty - item.receivedQty;
      if (remaining <= 0) continue;
      item.receivedQty = item.qty;

      if (item.productId) {
        const product = await Product.findOne({ _id: item.productId, tenantId });
        if (product) {
          const newStock = product.stock + remaining;
          await Product.updateOne(
            { _id: product._id },
            { $set: { stock: newStock } }
          );
          await InventoryMovement.create({
            tenantId,
            productId: product._id,
            type: 'purchase',
            qty: remaining,
            reason: `PO ${po.poNumber} received`,
            refType: 'purchase_order',
            refId: po._id,
            userId,
            balanceAfter: newStock,
          });
        }
      }
      anyReceived = true;
    }
  }

  if (!anyReceived) {
    throw ApiError.badRequest('NOTHING_RECEIVED', 'No items were received');
  }

  const allReceived = po.items.every((i) => i.receivedQty >= i.qty);
  po.status = allReceived ? 'received' : 'partial';
  if (allReceived) po.receivedAt = new Date();
  po.receivedBy = userId;

  await po.save();

  if (po.supplierId) {
    const supplier = await Supplier.findOne({ _id: po.supplierId, tenantId });
    if (supplier) {
      supplier.totalSpent = (supplier.totalSpent || 0) + po.total;
      supplier.lastOrderAt = new Date();
      await supplier.save();
    }
  }

  return po.toObject();
}

async function cancel(tenantId, id, reason) {
  const po = await PurchaseOrder.findOne({ _id: id, tenantId });
  if (!po) throw ApiError.notFound('PO_NOT_FOUND', 'Purchase order not found');
  if (po.status === 'cancelled') {
    throw ApiError.badRequest('ALREADY_CANCELLED', 'Already cancelled');
  }
  if (po.status === 'received') {
    throw ApiError.badRequest('RECEIVED', 'Cannot cancel a received order');
  }

  po.status = 'cancelled';
  po.cancelledAt = new Date();
  po.cancelReason = reason || 'No reason provided';
  await po.save();

  return po.toObject();
}

module.exports = { list, getById, create, update, send, receive, cancel };