const mongoose = require('mongoose');
const { ApiError } = require('./apiError');

function tenantFilter(req, extra = {}) {
  const tenantId = req.tenantId || req.user?.tenantId;
  if (!tenantId) throw ApiError.forbidden('NO_TENANT', 'Tenant context required');

  const id = mongoose.Types.ObjectId.isValid(tenantId)
    ? new mongoose.Types.ObjectId(tenantId)
    : tenantId;

  return { tenantId: id, ...extra };
}

module.exports = { tenantFilter };