const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const Tenant = require('../../models/admin/Tenant');
const cloudinaryService = require('../../services/cloudinaryService');

const get = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId).lean();
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');
  return ok(res, tenant);
});

const update = asyncHandler(async (req, res) => {
  const allowed = ['name', 'country', 'businessType'];
  const patch = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];

  if (req.body.settings && typeof req.body.settings === 'object') {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Tenant not found');
    tenant.settings = { ...tenant.settings, ...req.body.settings };
    Object.assign(tenant, patch);
    await tenant.save();
    return ok(res, tenant.toObject());
  }

  const tenant = await Tenant.findByIdAndUpdate(req.tenantId, patch, { new: true }).lean();
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