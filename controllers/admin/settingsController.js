const crypto = require('crypto');
const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const PlatformSetting = require('../../models/admin/PlatformSetting');
const { invalidateBrand } = require('../../services/brandService');

const PUBLIC_KEYS = [
  'platform_name',
  'platform_logo_url',
  'support_email',
  'support_phone',
  'platform_website',
  'default_currency',
  'default_country',
  'default_tax_rate',
  'tax_inclusive',
  'min_password_length',
  'registration_open',
  'maintenance_mode',
  'max_owners_per_tenant',
  'cashier_discount_limit',
  'cashier_refund_limit',
  'manager_can_invite_cashier',
  'require_shift_clock_in',
  'business_types',
  'countries',
  'currencies',
];

const FEATURE_KEYS = [
  'feature_pos',
  'feature_inventory',
  'feature_ai_insights',
  'feature_multi_location',
  'feature_loyalty',
  'feature_storefront',
  'feature_accounting',
  'feature_api',
  'feature_purchase_orders',
  'feature_invoices',
];

const DOWNLOAD_PLATFORMS = [
  'web',
  'windows',
  'macos',
  'linux',
  'android',
  'ios',
  'api',
  'template',
  'other',
];

const get = asyncHandler(async (_req, res) => {
  const docs = await PlatformSetting.find().lean();
  const map = Object.fromEntries(docs.map((d) => [d.key, d.value]));
  return ok(res, map);
});

const update = asyncHandler(async (req, res) => {
  const updates = req.body || {};
  const results = {};

  for (const [key, value] of Object.entries(updates)) {
    if (key.startsWith('feature_')) continue;
    if (key === 'downloads') continue;
    await PlatformSetting.setValue(key, value, req.admin.id);
    results[key] = value;
  }

  invalidateBrand().catch(() => {});
  return ok(res, results);
});

const updateFeatures = asyncHandler(async (req, res) => {
  const updates = req.body || {};
  const results = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!key.startsWith('feature_')) continue;
    await PlatformSetting.setValue(key, Boolean(value), req.admin.id);
    results[key] = Boolean(value);
  }

  invalidateBrand().catch(() => {});
  return ok(res, results);
});

const getPublic = asyncHandler(async (_req, res) => {
  const docs = await PlatformSetting.find({ key: { $in: PUBLIC_KEYS } }).lean();
  const map = Object.fromEntries(docs.map((d) => [d.key, d.value]));
  return ok(res, map);
});

const features = asyncHandler(async (_req, res) => {
  const docs = await PlatformSetting.find({ key: { $in: FEATURE_KEYS } }).lean();
  const map = Object.fromEntries(docs.map((d) => [d.key, d.value]));
  return ok(res, map);
});

const getDownloads = asyncHandler(async (_req, res) => {
  const list = await PlatformSetting.getValue('downloads', []);
  return ok(res, Array.isArray(list) ? list : []);
});

const createDownload = asyncHandler(async (req, res) => {
  const { name, link, platform } = req.body;

  if (!name || !link || !platform) {
    throw ApiError.badRequest('MISSING_FIELDS', 'name, link, platform required');
  }
  if (!DOWNLOAD_PLATFORMS.includes(platform)) {
    throw ApiError.badRequest('INVALID_PLATFORM', `Platform must be one of: ${DOWNLOAD_PLATFORMS.join(', ')}`);
  }

  const list = (await PlatformSetting.getValue('downloads', [])) || [];

  const entry = {
    id: crypto.randomUUID(),
    name,
    version: req.body.version || null,
    link,
    platform,
    description: req.body.description || null,
    isActive: req.body.isActive !== false,
    sortOrder: req.body.sortOrder ?? list.length,
    createdAt: new Date().toISOString(),
  };

  list.push(entry);
  await PlatformSetting.setValue('downloads', list, req.admin.id);

  return ok(res, entry);
});

const updateDownload = asyncHandler(async (req, res) => {
  const { downloadId } = req.params;

  const list = (await PlatformSetting.getValue('downloads', [])) || [];
  const index = list.findIndex((d) => d.id === downloadId);

  if (index === -1) {
    throw ApiError.notFound('DOWNLOAD_NOT_FOUND', 'Download not found');
  }

  const allowed = ['name', 'version', 'link', 'platform', 'description', 'isActive', 'sortOrder'];
  const patch = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }

  if (patch.platform && !DOWNLOAD_PLATFORMS.includes(patch.platform)) {
    throw ApiError.badRequest('INVALID_PLATFORM', `Platform must be one of: ${DOWNLOAD_PLATFORMS.join(', ')}`);
  }

  list[index] = { ...list[index], ...patch };
  await PlatformSetting.setValue('downloads', list, req.admin.id);

  return ok(res, list[index]);
});

const deleteDownload = asyncHandler(async (req, res) => {
  const { downloadId } = req.params;

  const list = (await PlatformSetting.getValue('downloads', [])) || [];
  const next = list.filter((d) => d.id !== downloadId);

  if (next.length === list.length) {
    throw ApiError.notFound('DOWNLOAD_NOT_FOUND', 'Download not found');
  }

  await PlatformSetting.setValue('downloads', next, req.admin.id);

  return ok(res, { deleted: true });
});

module.exports = {
  get,
  update,
  updateFeatures,
  getPublic,
  features,
  getDownloads,
  createDownload,
  updateDownload,
  deleteDownload,
};