const { cloudinary } = require('../config/cloudinary');
const { env } = require('../config/env');
const { ApiError } = require('../utils/apiError');
const { logger } = require('../utils/logger');

function assertEnabled() {
  if (!env.cloudinary.enabled) {
    throw ApiError.internal('STORAGE_DISABLED', 'Cloudinary not configured');
  }
}

function buildFolder(tenantId, kind) {
  return `bizos/${tenantId}/${kind}`;
}

function uploadBuffer(buffer, { folder, publicId, resourceType = 'image', format } = {}) {
  assertEnabled();

  return new Promise((resolve, reject) => {
    const options = {
      folder,
      public_id: publicId,
      resource_type: resourceType,
      overwrite: false,
    };
    if (format) options.format = format;

    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) {
        logger.error({ err: err.message }, 'cloudinary upload failed');
        return reject(ApiError.badRequest('UPLOAD_FAILED', 'Upload failed'));
      }
      resolve({
        url: result.secure_url,
        publicId: result.public_id,
        bytes: result.bytes,
        format: result.format,
        resourceType: result.resource_type,
      });
    });

    stream.end(buffer);
  });
}

async function uploadFromUrl(url, { folder, publicId, resourceType = 'image' } = {}) {
  assertEnabled();
  try {
    const result = await cloudinary.uploader.upload(url, {
      folder,
      public_id: publicId,
      resource_type: resourceType,
      overwrite: false,
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes,
      format: result.format,
      resourceType: result.resource_type,
    };
  } catch (err) {
    logger.error({ err: err.message }, 'cloudinary url upload failed');
    throw ApiError.badRequest('UPLOAD_FAILED', 'Upload failed');
  }
}

async function deleteAsset(publicId, resourceType = 'image') {
  if (!publicId || !env.cloudinary.enabled) return { deleted: false };
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return { deleted: true };
  } catch (err) {
    logger.error({ err: err.message, publicId }, 'cloudinary delete failed');
    return { deleted: false };
  }
}

function signedUrl(publicId, options = {}) {
  if (!publicId || !env.cloudinary.enabled) return null;
  return cloudinary.url(publicId, {
    secure: true,
    sign_url: true,
    ...options,
  });
}

module.exports = {
  buildFolder,
  uploadBuffer,
  uploadFromUrl,
  deleteAsset,
  signedUrl,
};