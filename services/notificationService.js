const mongoose = require('mongoose');
const { ApiError } = require('../utils/apiError');
const Notification = require('../models/client/Notification');

function scopeForUser(tenantId, userId) {
  return {
    tenantId: new mongoose.Types.ObjectId(tenantId),
    $or: [
      { userId: null },
      { userId: new mongoose.Types.ObjectId(userId) },
    ],
  };
}

async function create({
  tenantId,
  userId = null,
  type,
  severity = 'info',
  title,
  detail = '',
  source = 'System',
  refType = null,
  refId = null,
}) {
  if (!tenantId || !type || !title) {
    throw ApiError.badRequest(
      'MISSING_FIELDS',
      'tenantId, type and title are required'
    );
  }

  const doc = await Notification.create({
    tenantId,
    userId,
    type,
    severity,
    title,
    detail,
    source,
    refType,
    refId,
  });

  return doc.toObject();
}

async function createIfNotRecent({
  tenantId,
  userId = null,
  type,
  refType = null,
  refId = null,
  withinHours = 24,
  ...rest
}) {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);

  const existing = await Notification.findOne({
    tenantId,
    userId,
    type,
    refType,
    refId,
    archivedAt: null,
    createdAt: { $gte: since },
  }).lean();

  if (existing) return null;

  return create({ tenantId, userId, type, refType, refId, ...rest });
}

async function listForUser(
  tenantId,
  userId,
  { page = 1, limit = 30, filter = 'all', search = '' } = {}
) {
  const scope = scopeForUser(tenantId, userId);
  const query = { ...scope, archivedAt: null, snoozedAt: null };

  if (filter === 'unread') {
    query.readAt = null;
  } else if (['info', 'success', 'warning', 'danger'].includes(filter)) {
    query.severity = filter;
  }

  if (search && search.trim()) {
    const rx = new RegExp(search.trim(), 'i');
    query.$and = [
      { $or: [{ title: rx }, { detail: rx }, { source: rx }] },
    ];
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(query),
  ]);

  return { items, total, page, limit };
}

async function unreadCount(tenantId, userId) {
  const scope = scopeForUser(tenantId, userId);
  const count = await Notification.countDocuments({
    ...scope,
    readAt: null,
    archivedAt: null,
    snoozedAt: null,
  });
  return count;
}

async function summary(tenantId, userId) {
  const scope = scopeForUser(tenantId, userId);
  const match = { ...scope, archivedAt: null };

  const result = await Notification.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: { $cond: [{ $eq: ['$readAt', null] }, 1, 0] },
        },
        danger: {
          $sum: { $cond: [{ $eq: ['$severity', 'danger'] }, 1, 0] },
        },
        warning: {
          $sum: { $cond: [{ $eq: ['$severity', 'warning'] }, 1, 0] },
        },
        success: {
          $sum: { $cond: [{ $eq: ['$severity', 'success'] }, 1, 0] },
        },
        info: {
          $sum: { $cond: [{ $eq: ['$severity', 'info'] }, 1, 0] },
        },
      },
    },
  ]);

  return (
    result[0] || {
      total: 0,
      unread: 0,
      danger: 0,
      warning: 0,
      success: 0,
      info: 0,
    }
  );
}

async function markRead(tenantId, userId, id) {
  const scope = scopeForUser(tenantId, userId);
  const doc = await Notification.findOneAndUpdate(
    { ...scope, _id: id },
    { $set: { readAt: new Date() } },
    { new: true }
  ).lean();

  if (!doc) throw ApiError.notFound('NOTIFICATION_NOT_FOUND', 'Notification not found');
  return doc;
}

async function markAllRead(tenantId, userId) {
  const scope = scopeForUser(tenantId, userId);
  const result = await Notification.updateMany(
    { ...scope, readAt: null, archivedAt: null },
    { $set: { readAt: new Date() } }
  );
  return { modified: result.modifiedCount };
}

async function snooze(tenantId, userId, id) {
  const scope = scopeForUser(tenantId, userId);
  const doc = await Notification.findOneAndUpdate(
    { ...scope, _id: id },
    { $set: { snoozedAt: new Date(), readAt: new Date() } },
    { new: true }
  ).lean();

  if (!doc) throw ApiError.notFound('NOTIFICATION_NOT_FOUND', 'Notification not found');
  return doc;
}

async function unsnooze(tenantId, userId, id) {
  const scope = scopeForUser(tenantId, userId);
  const doc = await Notification.findOneAndUpdate(
    { ...scope, _id: id },
    { $set: { snoozedAt: null } },
    { new: true }
  ).lean();

  if (!doc) throw ApiError.notFound('NOTIFICATION_NOT_FOUND', 'Notification not found');
  return doc;
}

async function archive(tenantId, userId, id) {
  const scope = scopeForUser(tenantId, userId);
  const doc = await Notification.findOneAndUpdate(
    { ...scope, _id: id },
    { $set: { archivedAt: new Date(), readAt: new Date() } },
    { new: true }
  ).lean();

  if (!doc) throw ApiError.notFound('NOTIFICATION_NOT_FOUND', 'Notification not found');
  return doc;
}

async function remove(tenantId, userId, id) {
  const scope = scopeForUser(tenantId, userId);
  const result = await Notification.deleteOne({ ...scope, _id: id });
  if (result.deletedCount === 0) {
    throw ApiError.notFound('NOTIFICATION_NOT_FOUND', 'Notification not found');
  }
  return { deleted: true };
}

async function clearRead(tenantId, userId) {
  const scope = scopeForUser(tenantId, userId);
  const result = await Notification.deleteMany({
    ...scope,
    readAt: { $ne: null },
    archivedAt: null,
  });
  return { deleted: result.deletedCount };
}

module.exports = {
  create,
  createIfNotRecent,
  listForUser,
  unreadCount,
  summary,
  markRead,
  markAllRead,
  snooze,
  unsnooze,
  archive,
  remove,
  clearRead,
};