const mongoose = require('mongoose');
const Tenant = require('../models/admin/Tenant');
const PendingActivation = require('../models/admin/PendingActivation');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');

const TENANT_COLLECTIONS = [
  'users',
  'products',
  'sales',
  'payments',
  'customers',
  'suppliers',
  'inventorymovements',
  'purchaseorders',
  'invoices',
  'userinvitations',
  'dailymetrics',
  'aiconversations',
  'aiusagelogs',
  'auditlogs',
  'adminactions',
];

async function purgeCloudinary(tenantId) {
  if (!env.cloudinary.enabled) {
    return { skipped: true, images: 0, raws: 0 };
  }

  const { cloudinary } = require('../config/cloudinary');
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const db = mongoose.connection.db;

  const [products, tenant, sales, invoices] = await Promise.all([
    db
      .collection('products')
      .find({ tenantId: tenantObjectId }, { projection: { imagePublicId: 1 } })
      .toArray(),
    db
      .collection('tenants')
      .findOne({ _id: tenantObjectId }, { projection: { 'settings.logoPublicId': 1 } }),
    db
      .collection('sales')
      .find({ tenantId: tenantObjectId }, { projection: { receiptPublicId: 1 } })
      .toArray(),
    db
      .collection('invoices')
      .find({ tenantId: tenantObjectId }, { projection: { pdfPublicId: 1 } })
      .toArray(),
  ]);

  const imageIds = [
    ...products.map((p) => p.imagePublicId),
    tenant?.settings?.logoPublicId,
  ].filter(Boolean);

  const rawIds = [
    ...sales.map((s) => s.receiptPublicId),
    ...invoices.map((i) => i.pdfPublicId),
  ].filter(Boolean);

  let images = 0;
  let raws = 0;

  if (imageIds.length) {
    try {
      const res = await cloudinary.api.delete_resources(imageIds, { resource_type: 'image' });
      images = Object.keys(res.deleted || {}).length;
    } catch (err) {
      logger.warn({ err: err.message }, 'cloudinary image purge failed');
    }
  }

  if (rawIds.length) {
    try {
      const res = await cloudinary.api.delete_resources(rawIds, { resource_type: 'raw' });
      raws = Object.keys(res.deleted || {}).length;
    } catch (err) {
      logger.warn({ err: err.message }, 'cloudinary raw purge failed');
    }
  }

  const folders = [
    `bizos/${tenantId}/products`,
    `bizos/${tenantId}/logo`,
    `bizos/${tenantId}/receipts`,
    `bizos/${tenantId}/invoices`,
    `bizos/${tenantId}/reports`,
  ];

  for (const folder of folders) {
    try {
      await cloudinary.api.delete_folder(folder);
    } catch {
      // folder may not exist
    }
  }

  return { skipped: false, images, raws };
}

async function purge(tenantId) {
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const db = mongoose.connection.db;

  const cloudinaryResult = await purgeCloudinary(tenantId);

  const summary = {};

  for (const name of TENANT_COLLECTIONS) {
    try {
      const result = await db.collection(name).deleteMany({ tenantId: tenantObjectId });
      summary[name] = result.deletedCount;
    } catch (err) {
      logger.error({ err: err.message, collection: name, tenantId }, 'purge failed');
      summary[name] = `error: ${err.message}`;
    }
  }

  try {
    const pendingResult = await PendingActivation.deleteMany({ tenantId: tenantObjectId });
    summary.pendingactivations = pendingResult.deletedCount;
  } catch (err) {
    summary.pendingactivations = `error: ${err.message}`;
  }

  try {
    const tenantResult = await Tenant.deleteOne({ _id: tenantObjectId });
    summary.tenants = tenantResult.deletedCount;
  } catch (err) {
    summary.tenants = `error: ${err.message}`;
  }

  summary.cloudinary = cloudinaryResult;

  logger.warn({ tenantId, summary }, 'tenant purged');

  return summary;
}

module.exports = { purge, TENANT_COLLECTIONS };