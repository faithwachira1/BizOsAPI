const crypto = require('crypto');
const Legal = require('../models/admin/Legal');
const { ApiError } = require('../utils/apiError');

const PUBLIC_FIELDS = ['type', 'version', 'title', 'content', 'effectiveAt'];

function toPublic(doc) {
  const out = {};
  for (const k of PUBLIC_FIELDS) out[k] = doc[k];
  return out;
}

async function getCurrent(type) {
  const doc = await Legal.findOne({ type, isCurrent: true }).lean();
  if (!doc) throw ApiError.notFound('LEGAL_NOT_FOUND', 'Document not found');
  return toPublic(doc);
}

async function listByType(type) {
  return Legal.find({ type }).sort({ version: -1 }).lean();
}

async function getByVersion(type, version) {
  const doc = await Legal.findOne({ type, version: Number(version) }).lean();
  if (!doc) throw ApiError.notFound('LEGAL_NOT_FOUND', 'Version not found');
  return doc;
}

async function publish({ type, title, content, effectiveAt, adminId }) {
  if (!type || !content) throw ApiError.badRequest('MISSING_FIELDS', 'type and content required');

  const last = await Legal.findOne({ type }).sort({ version: -1 }).lean();
  const nextVersion = (last?.version || 0) + 1;
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');

  if (last?.isCurrent) {
    await Legal.updateOne({ _id: last._id }, { $set: { isCurrent: false } });
  }

  const doc = await Legal.create({
    type,
    version: nextVersion,
    title: title || type,
    content,
    contentHash,
    effectiveAt: effectiveAt || new Date(),
    publishedAt: new Date(),
    publishedBy: adminId,
    isCurrent: true,
  });

  return doc.toObject();
}

async function updateDraft(id, { title, content, effectiveAt }) {
  const doc = await Legal.findById(id);
  if (!doc) throw ApiError.notFound('LEGAL_NOT_FOUND', 'Document not found');
  if (doc.publishedAt) throw ApiError.badRequest('PUBLISHED_IMMUTABLE', 'Published versions cannot be edited');

  if (title) doc.title = title;
  if (content) {
    doc.content = content;
    doc.contentHash = crypto.createHash('sha256').update(content).digest('hex');
  }
  if (effectiveAt) doc.effectiveAt = effectiveAt;

  await doc.save();
  return doc.toObject();
}

async function removeDraft(id) {
  const doc = await Legal.findById(id);
  if (!doc) throw ApiError.notFound('LEGAL_NOT_FOUND', 'Document not found');
  if (doc.publishedAt) throw ApiError.badRequest('PUBLISHED_IMMUTABLE', 'Cannot delete published versions');
  await doc.deleteOne();
  return { deleted: true };
}

module.exports = {
  getCurrent,
  listByType,
  getByVersion,
  publish,
  updateDraft,
  removeDraft,
};