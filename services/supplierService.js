const Supplier = require('../models/client/Supplier');
const PurchaseOrder = require('../models/client/PurchaseOrder');
const { ApiError } = require('../utils/apiError');
const { logger } = require('../utils/logger');

async function list(tenantId, { page = 1, limit = 20, search, active } = {}) {
  const filter = { tenantId };
  if (active !== undefined) filter.active = active;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { contactName: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Supplier.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Supplier.countDocuments(filter),
  ]);

  return { items, total };
}

async function getById(tenantId, id) {
  const supplier = await Supplier.findOne({ _id: id, tenantId }).lean();
  if (!supplier) throw ApiError.notFound('SUPPLIER_NOT_FOUND', 'Supplier not found');
  return supplier;
}

async function create(tenantId, payload) {
  const { name } = payload;
  if (!name) throw ApiError.badRequest('NAME_REQUIRED', 'Supplier name is required');

  const supplier = await Supplier.create({
    tenantId,
    name,
    contactName: payload.contactName || null,
    phone: payload.phone || null,
    email: payload.email ? payload.email.toLowerCase() : null,
    address: payload.address || null,
    notes: payload.notes || null,
  });

  logger.info({ tenantId, supplierId: supplier._id }, 'supplier created');

  return supplier.toObject();
}

async function update(tenantId, id, payload) {
  const allowed = ['name', 'contactName', 'phone', 'email', 'address', 'notes', 'active'];
  const patch = {};
  for (const k of allowed) {
    if (payload[k] !== undefined) patch[k] = payload[k];
  }

  if (patch.email) patch.email = patch.email.toLowerCase();

  const supplier = await Supplier.findOneAndUpdate(
    { _id: id, tenantId },
    patch,
    { new: true }
  ).lean();

  if (!supplier) throw ApiError.notFound('SUPPLIER_NOT_FOUND', 'Supplier not found');
  return supplier;
}

async function remove(tenantId, id) {
  const supplier = await Supplier.findOne({ _id: id, tenantId });
  if (!supplier) throw ApiError.notFound('SUPPLIER_NOT_FOUND', 'Supplier not found');

  const activeOrders = await PurchaseOrder.countDocuments({
    tenantId,
    supplierId: id,
    status: { $in: ['draft', 'sent', 'partial'] },
  });

  if (activeOrders > 0) {
    throw ApiError.badRequest(
      'SUPPLIER_HAS_ORDERS',
      `Cannot delete: ${activeOrders} active purchase order(s) reference this supplier`
    );
  }

  supplier.active = false;
  await supplier.save();

  logger.info({ tenantId, supplierId: id }, 'supplier deactivated');

  return { deleted: true };
}

async function orders(tenantId, supplierId, { page = 1, limit = 20 } = {}) {
  const supplier = await Supplier.findOne({ _id: supplierId, tenantId }).lean();
  if (!supplier) throw ApiError.notFound('SUPPLIER_NOT_FOUND', 'Supplier not found');

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    PurchaseOrder.find({ tenantId, supplierId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PurchaseOrder.countDocuments({ tenantId, supplierId }),
  ]);

  return { items, total, supplier: { _id: supplier._id, name: supplier.name } };
}

module.exports = { list, getById, create, update, remove, orders };