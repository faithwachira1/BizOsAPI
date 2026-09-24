const crypto = require('crypto');
const os = require('os');
const mongoose = require('mongoose');

const Backup = require('../models/admin/Backup');
const PlatformSetting = require('../models/admin/PlatformSetting');
const { cloudinary } = require('../config/cloudinary');
const emailService = require('./emailService');
const { ApiError } = require('../utils/apiError');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');

const COLLECTIONS = [
  'tenants',
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
  'superadmins',
  'platformsettings',
  'paymentmethods',
  'aiusagelogs',
  'legals',
  'backups',
  'plans',
  'pendingactivations',
];

const CLOUDINARY_FOLDER = 'bizos/backups';

function formatDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function assertCloudinary() {
  if (!env.cloudinary.enabled) {
    throw ApiError.internal('STORAGE_DISABLED', 'Cloudinary not configured');
  }
}

function uploadRaw(buffer, publicId) {
  assertCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        public_id: publicId,
        resource_type: 'raw',
        format: 'json',
        overwrite: true,
        invalidate: true,
      },
      (err, result) => {
        if (err) {
          logger.error({ err: err.message }, 'cloudinary backup upload failed');
          return reject(ApiError.internal('UPLOAD_FAILED', 'Could not upload backup'));
        }
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

async function fetchRaw(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw ApiError.internal('FETCH_FAILED', `Could not fetch backup (${res.status})`);
  }
  return res.text();
}

async function createBackup({ type = 'manual', triggeredBy = null } = {}) {
  const startedAt = new Date();
  const pkg = require('../package.json');

  const doc = await Backup.create({
    filename: 'pending',
    sizeBytes: 0,
    type,
    status: 'running',
    startedAt,
    triggeredBy,
  });

  try {
    const data = {};
    const recordCounts = {};

    for (const name of COLLECTIONS) {
      const rows = await mongoose.connection.db.collection(name).find({}).toArray();
      data[name] = rows;
      recordCounts[name] = rows.length;
    }

    const payload = {
      meta: {
        version: '1.0',
        appVersion: pkg.version,
        createdAt: new Date().toISOString(),
        type,
        hostname: os.hostname(),
        database: mongoose.connection.db.databaseName,
        collections: COLLECTIONS,
      },
      data,
    };

    const filename = `backup-${formatDate(new Date())}-${doc._id.toString().slice(-4)}.json`;
    const publicId = filename.replace(/\.json$/, '');
    const json = JSON.stringify(payload, null, 2);
    const buffer = Buffer.from(json, 'utf8');

    const upload = await uploadRaw(buffer, publicId);

    const checksum = crypto.createHash('sha256').update(json).digest('hex');
    const completedAt = new Date();
    const retentionDays = await PlatformSetting.getValue('backup_retention_days', 90);

    doc.filename = filename;
    doc.publicId = upload.public_id;
    doc.url = upload.secure_url;
    doc.sizeBytes = upload.bytes;
    doc.checksum = checksum;
    doc.status = 'success';
    doc.completedAt = completedAt;
    doc.durationMs = completedAt - startedAt;
    doc.collections = COLLECTIONS;
    doc.recordCounts = recordCounts;
    doc.retentionUntil = new Date(completedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
    await doc.save();

    logger.info(
      { filename, publicId: upload.public_id, sizeBytes: upload.bytes, durationMs: doc.durationMs },
      'backup uploaded to cloudinary'
    );

    return doc;
  } catch (err) {
    doc.status = 'failed';
    doc.error = err.message;
    doc.completedAt = new Date();
    await doc.save();
    logger.error({ err: err.message }, 'backup failed');
    throw err;
  }
}

async function listBackups({ page = 1, limit = 20, status } = {}) {
  const filter = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Backup.find(filter).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
    Backup.countDocuments(filter),
  ]);

  return { items, total };
}

async function getBackup(id) {
  const doc = await Backup.findById(id).lean();
  if (!doc) throw ApiError.notFound('BACKUP_NOT_FOUND', 'Backup not found');
  return doc;
}

async function getDownloadUrl(id) {
  const doc = await Backup.findById(id).lean();
  if (!doc) throw ApiError.notFound('BACKUP_NOT_FOUND', 'Backup not found');
  if (!doc.url) throw ApiError.notFound('BACKUP_URL_MISSING', 'Backup has no download URL');

  const signed = cloudinary.url(doc.publicId, {
    resource_type: 'raw',
    type: 'upload',
    secure: true,
    sign_url: true,
    flags: 'attachment',
  });

  return { doc, url: signed };
}

async function deleteBackup(id) {
  const doc = await Backup.findById(id);
  if (!doc) throw ApiError.notFound('BACKUP_NOT_FOUND', 'Backup not found');

  if (doc.publicId) {
    try {
      await cloudinary.uploader.destroy(doc.publicId, { resource_type: 'raw', invalidate: true });
    } catch (err) {
      logger.warn({ err: err.message, publicId: doc.publicId }, 'cloudinary delete failed');
    }
  }

  await doc.deleteOne();
  logger.info({ backupId: id, filename: doc.filename }, 'backup deleted');
  return { deleted: true };
}

async function restoreBackup(id, { confirm = false } = {}) {
  if (!confirm) {
    throw ApiError.badRequest('CONFIRM_REQUIRED', 'confirm: true required');
  }

  if (env.isProd && process.env.ALLOW_RESTORE !== 'true') {
    throw ApiError.forbidden('RESTORE_BLOCKED', 'Restore disabled in production');
  }

  const doc = await Backup.findById(id).lean();
  if (!doc) throw ApiError.notFound('BACKUP_NOT_FOUND', 'Backup not found');
  if (!doc.url) throw ApiError.notFound('BACKUP_URL_MISSING', 'Backup has no URL');

  const raw = await fetchRaw(doc.url);
  const payload = JSON.parse(raw);

  if (payload.meta?.version !== '1.0') {
    throw ApiError.badRequest('VERSION_MISMATCH', 'Unsupported backup version');
  }

  logger.warn({ backupId: id, filename: doc.filename }, 'restore: creating pre-restore snapshot');
  await createBackup({ type: 'manual' });

  const restored = [];
  const skipped = [];

  for (const [name, rows] of Object.entries(payload.data)) {
    if (!COLLECTIONS.includes(name)) {
      skipped.push(name);
      continue;
    }

    const coll = mongoose.connection.db.collection(name);
    await coll.deleteMany({});
    if (rows.length) {
      await coll.insertMany(rows, { ordered: false });
    }
    restored.push(name);
  }

  logger.warn({ backupId: id, filename: doc.filename, restored, skipped }, 'restore completed');

  return {
    restored: doc.filename,
    collections: restored,
    skipped,
    at: new Date().toISOString(),
  };
}

async function sendBackupByEmail(id, to) {
  if (!to) throw ApiError.badRequest('EMAIL_REQUIRED', 'Recipient email required');

  const doc = await Backup.findById(id).lean();
  if (!doc) throw ApiError.notFound('BACKUP_NOT_FOUND', 'Backup not found');
  if (!doc.url) throw ApiError.notFound('BACKUP_URL_MISSING', 'Backup has no URL');

  await emailService.sendMail({
    to,
    subject: `BizOS Backup — ${doc.filename}`,
    html: `<p>Backup from ${doc.completedAt?.toISOString() || 'unknown'} (${formatBytes(doc.sizeBytes)}).</p><p><a href="${doc.url}">Download</a></p>`,
    text: `Backup ${doc.filename} (${formatBytes(doc.sizeBytes)})\n${doc.url}`,
  });

  logger.info({ backupId: id, to }, 'backup email sent');
  return { sent: true, to };
}

async function cleanupExpired() {
  const now = new Date();

  const expired = await Backup.find({
    retentionUntil: { $lt: now },
    status: { $ne: 'expired' },
  });

  let cleaned = 0;
  for (const doc of expired) {
    try {
      if (doc.publicId) {
        await cloudinary.uploader
          .destroy(doc.publicId, { resource_type: 'raw', invalidate: true })
          .catch(() => {});
      }
      doc.status = 'expired';
      await doc.save();
      cleaned++;
    } catch (err) {
      logger.error({ err: err.message, backupId: doc._id }, 'cleanupExpired failed');
    }
  }

  if (cleaned) logger.info({ cleaned }, 'expired backups cleaned');
  return { cleaned };
}

async function getStats() {
  const [total, lastSuccess] = await Promise.all([
    Backup.countDocuments({ status: 'success' }),
    Backup.findOne({ status: 'success' }).sort({ completedAt: -1 }).lean(),
  ]);

  return {
    total,
    lastBackupAt: lastSuccess?.completedAt || null,
    lastBackupSize: lastSuccess?.sizeBytes || null,
  };
}

module.exports = {
  createBackup,
  listBackups,
  getBackup,
  getDownloadUrl,
  deleteBackup,
  restoreBackup,
  sendBackupByEmail,
  cleanupExpired,
  getStats,
  COLLECTIONS,
};