const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const Tenant = require('../../models/admin/Tenant');
const cloudinaryService = require('../../services/cloudinaryService');
const { validatePatch } = require('../../services/settingsService');

const BUSINESS_TYPES = ['retail', 'restaurant', 'salon', 'pharmacy', 'other'];

const get = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId).lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');
  return ok(res, tenant);
});

const update = asyncHandler(async (req, res) => {
  const { name, country, businessType } = req.body;

  const patch = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (country !== undefined) patch.country = String(country).trim();
  if (businessType !== undefined) {
    if (!BUSINESS_TYPES.includes(businessType)) {
      throw ApiError.badRequest(
        'INVALID_BUSINESS_TYPE',
        `businessType must be one of: ${BUSINESS_TYPES.join(', ')}`
      );
    }
    patch.businessType = businessType;
  }

  // Settings subdocument — validated against allow-list
  let settingsPatch = null;
  if (req.body.settings && typeof req.body.settings === 'object') {
    const { patch: validated } = validatePatch(req.body.settings);
    if (Object.keys(validated).length) settingsPatch = validated;
  }

  // Flat settings keys passed at top level (alternative shape)
  const topLevelSettings = {};
  for (const key of ['phone', 'address', 'taxPin', 'website']) {
    if (req.body[key] !== undefined) topLevelSettings[key] = req.body[key];
  }
  if (Object.keys(topLevelSettings).length) {
    settingsPatch = { ...(settingsPatch || {}), ...topLevelSettings };
  }

  if (!Object.keys(patch).length && !settingsPatch) {
    throw ApiError.badRequest('NO_CHANGES', 'No valid fields provided');
  }

  const update = {};
  if (Object.keys(patch).length) Object.assign(update, patch);
  if (settingsPatch) {
    for (const [k, v] of Object.entries(settingsPatch)) {
      update[`settings.${k}`] = v;
    }
  }

  const tenant = await Tenant.findByIdAndUpdate(req.tenantId, { $set: update }, {
    new: true,
    runValidators: true,
  }).lean();

  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');
  return ok(res, tenant);
});

const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('NO_FILE', 'File required');

  const folder = cloudinaryService.buildFolder(req.tenantId, 'logo');
  const result = await cloudinaryService.uploadBuffer(req.file.buffer, {
    folder,
    publicId: 'logo',
    resourceType: 'image',
  });

  await Tenant.updateOne(
    { _id: req.tenantId },
    {
      $set: {
        'settings.logoUrl': result.url,
        'settings.logoPublicId': result.publicId,
      },
    }
  );

  return ok(res, { url: result.url, publicId: result.publicId });
});

module.exports = { get, update, uploadLogo };