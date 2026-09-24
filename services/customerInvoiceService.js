const { ApiError } = require('../utils/apiError');
const Tenant = require('../models/admin/Tenant');
const Invoice = require('../models/client/Invoice');
const Customer = require('../models/client/Customer');
const Product = require('../models/client/Product');
const InventoryMovement = require('../models/client/InventoryMovement');
const CustomerLedger = require('../models/client/CustomerLedger');
const { logger } = require('../utils/logger');

function generateInvoiceNumber() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CINV-${stamp}-${rand}`;
}

async function applyLedger({
  tenantId,
  customerId,
  amount,
  type,
  refType,
  refId,
  description,
  userId,
}) {
  const customer = await Customer.findOne({ _id: customerId, tenantId });
  if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');

  const nextBalance = Math.max(0, (customer.outstanding || 0) + amount);
  customer.outstanding = nextBalance;
  await customer.save();

  await CustomerLedger.create({
    tenantId,
    customerId,
    type,
    amount,
    balanceAfter: nextBalance,
    refType,
    refId,
    description,
    userId,
  });

  return nextBalance;
}

async function deductStock({ tenantId, invoice, userId }) {
  if (invoice.stockDeducted) return;

  for (const item of invoice.items) {
    if (!item.productId) continue;

    const product = await Product.findOne({ _id: item.productId, tenantId });
    if (!product) continue;

    const newStock = product.stock - item.qty;

    await Product.updateOne(
      { _id: product._id },
      { $set: { stock: newStock } }
    );

    await InventoryMovement.create({
      tenantId,
      productId: product._id,
      type: 'invoice',
      qty: -item.qty,
      reason: `Invoice ${invoice.invoiceNumber}`,
      refType: 'invoice',
      refId: invoice._id,
      userId,
      balanceAfter: newStock,
    });
  }

  invoice.stockDeducted = true;
  await invoice.save();
}

async function restoreStock({ tenantId, invoice, userId }) {
  if (!invoice.stockDeducted) return;

  for (const item of invoice.items) {
    if (!item.productId) continue;

    const product = await Product.findOne({ _id: item.productId, tenantId });
    if (!product) continue;

    const newStock = product.stock + item.qty;

    await Product.updateOne(
      { _id: product._id },
      { $set: { stock: newStock } }
    );

    await InventoryMovement.create({
      tenantId,
      productId: product._id,
      type: 'invoice_return',
      qty: item.qty,
      reason: `Invoice ${invoice.invoiceNumber} cancelled`,
      refType: 'invoice',
      refId: invoice._id,
      userId,
      balanceAfter: newStock,
    });
  }

  invoice.stockDeducted = false;
  await invoice.save();
}

async function create({ tenantId, userId, payload }) {
  const {
    customerId,
    items,
    discount = 0,
    dueDate,
    notes,
  } = payload;

  if (!customerId) throw ApiError.badRequest('CUSTOMER_REQUIRED', 'Customer is required');
  if (!Array.isArray(items) || !items.length) {
    throw ApiError.badRequest('NO_ITEMS', 'At least one item is required');
  }

  const customer = await Customer.findOne({ _id: customerId, tenantId }).lean();
  if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'Customer not found');

  const tenant = await Tenant.findById(tenantId).select('settings').lean();
  const rawTaxRate = Number(tenant?.settings?.taxRate ?? 0);
  const taxRate = Number.isFinite(rawTaxRate) && rawTaxRate > 0 ? rawTaxRate : 0;
  const taxInclusive = tenant?.settings?.taxInclusive === true;
  const currency = tenant?.settings?.currency || 'KES';

  const productIds = items
    .filter((i) => i.productId)
    .map((i) => i.productId);

  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, tenantId }).lean()
    : [];
  const byId = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  let subtotal = 0;
  const invoiceItems = [];

  for (const item of items) {
    const qty = Number(item.qty) || 0;
    if (qty <= 0) {
      throw ApiError.badRequest('INVALID_QTY', 'Item quantity must be positive');
    }

    let name = item.name;
    let unitPrice = Number(item.unitPrice) || 0;
    let productId = null;

    if (item.productId) {
      const product = byId[String(item.productId)];
      if (!product) {
        throw ApiError.badRequest('PRODUCT_NOT_FOUND', `Product not found`);
      }
      productId = product._id;
      name = product.name;
      unitPrice = product.price;
    }

    if (!name) throw ApiError.badRequest('ITEM_NAME_REQUIRED', 'Item name required');
    if (unitPrice < 0) throw ApiError.badRequest('INVALID_PRICE', 'Price must be ≥ 0');

    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    invoiceItems.push({
      productId,
      name,
      description: item.description || null,
      qty,
      unitPrice,
      subtotal: lineTotal,
    });
  }

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

  const invoice = await Invoice.create({
    tenantId,
    type: 'customer',
    invoiceNumber: generateInvoiceNumber(),
    customerId: customer._id,
    customerSnapshot: {
      name: customer.name,
      email: customer.email || null,
      phone: customer.phone || null,
      address: customer.address || null,
    },
    items: invoiceItems,
    subtotal,
    discount,
    tax,
    total,
    amountPaid: 0,
    amountDue: total,
    currency,
    status: 'draft',
    dueDate: dueDate ? new Date(dueDate) : null,
    issuedAt: new Date(),
    notes: notes || null,
    createdBy: userId,
  });

  return invoice.toObject();
}

async function send({ tenantId, userId, invoiceId }) {
  const invoice = await Invoice.findOne({
    _id: invoiceId,
    tenantId,
    type: 'customer',
  });

  if (!invoice) throw ApiError.notFound('INVOICE_NOT_FOUND', 'Invoice not found');
  if (invoice.status === 'cancelled') {
    throw ApiError.badRequest('CANCELLED', 'Cannot send a cancelled invoice');
  }
  if (invoice.status === 'paid') {
    throw ApiError.badRequest('PAID', 'Invoice already paid');
  }

  if (!invoice.sentAt) {
    invoice.sentAt = new Date();
  }
  if (invoice.status === 'draft') {
    invoice.status = 'sent';
  }
  await invoice.save();

  if (!invoice.stockDeducted) {
    await deductStock({ tenantId, invoice, userId });
  }

  if (invoice.customerId) {
    await applyLedger({
      tenantId,
      customerId: invoice.customerId,
      amount: invoice.amountDue,
      type: 'invoice',
      refType: 'invoice',
      refId: invoice._id,
      description: `Invoice ${invoice.invoiceNumber}`,
      userId,
    });
  }

  return invoice.toObject();
}

async function recordPayment({
  tenantId,
  userId,
  invoiceId,
  amount,
  method,
  reference,
  note,
}) {
  const invoice = await Invoice.findOne({
    _id: invoiceId,
    tenantId,
    type: 'customer',
  });

  if (!invoice) throw ApiError.notFound('INVOICE_NOT_FOUND', 'Invoice not found');
  if (invoice.status === 'cancelled') {
    throw ApiError.badRequest('CANCELLED', 'Invoice is cancelled');
  }

  const paid = Number(amount);
  if (!Number.isFinite(paid) || paid <= 0) {
    throw ApiError.badRequest('INVALID_AMOUNT', 'Amount must be positive');
  }
  if (paid > invoice.amountDue) {
    throw ApiError.badRequest('OVERPAY', 'Amount exceeds amount due');
  }

  invoice.payments.push({
    amount: paid,
    method: method || null,
    reference: reference || null,
    note: note || null,
    recordedBy: userId,
    recordedAt: new Date(),
  });

  invoice.amountPaid = (invoice.amountPaid || 0) + paid;
  invoice.amountDue = Math.max(0, invoice.total - invoice.amountPaid);

  if (invoice.amountDue === 0) {
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.paymentMethod = method || invoice.paymentMethod;
    invoice.paymentRef = reference || invoice.paymentRef;
  } else if (invoice.amountPaid > 0) {
    invoice.status = 'partial';
  }

  await invoice.save();

  if (invoice.customerId) {
    await applyLedger({
      tenantId,
      customerId: invoice.customerId,
      amount: -paid,
      type: 'payment',
      refType: 'payment',
      refId: invoice._id,
      description: `Payment for ${invoice.invoiceNumber}`,
      userId,
    });

    const customer = await Customer.findOne({
      _id: invoice.customerId,
      tenantId,
    });
    if (customer) {
      customer.totalSpent = (customer.totalSpent || 0) + paid;
      customer.lastPurchaseAt = new Date();
      await customer.save();
    }
  }

  return invoice.toObject();
}

async function cancel({ tenantId, userId, invoiceId, reason }) {
  const invoice = await Invoice.findOne({
    _id: invoiceId,
    tenantId,
    type: 'customer',
  });

  if (!invoice) throw ApiError.notFound('INVOICE_NOT_FOUND', 'Invoice not found');
  if (invoice.status === 'paid') {
    throw ApiError.badRequest('PAID', 'Cannot cancel a paid invoice');
  }
  if (invoice.status === 'cancelled') {
    throw ApiError.badRequest('ALREADY_CANCELLED', 'Already cancelled');
  }

  if (invoice.stockDeducted) {
    await restoreStock({ tenantId, invoice, userId });
  }

  const remainingDue = invoice.amountDue;
  invoice.status = 'cancelled';
  invoice.cancelledAt = new Date();
  invoice.cancelReason = reason || 'No reason provided';
  await invoice.save();

  if (invoice.customerId && remainingDue > 0) {
    await applyLedger({
      tenantId,
      customerId: invoice.customerId,
      amount: -remainingDue,
      type: 'writeoff',
      refType: 'invoice',
      refId: invoice._id,
      description: `Invoice ${invoice.invoiceNumber} cancelled`,
      userId,
    });
  }

  return invoice.toObject();
}

async function recomputeOutstanding({ tenantId, customerId }) {
  const result = await Invoice.aggregate([
    {
      $match: {
        tenantId,
        customerId,
        type: 'customer',
        status: { $in: ['sent', 'partial', 'overdue'] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amountDue' },
      },
    },
  ]);

  const next = result[0]?.total || 0;

  await Customer.updateOne({ _id: customerId, tenantId }, { $set: { outstanding: next } });

  return next;
}

module.exports = {
  create,
  send,
  recordPayment,
  cancel,
  recomputeOutstanding,
  generateInvoiceNumber,
};