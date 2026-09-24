const { ApiError } = require('./apiError');

function tenantFilter(req, extra = {}) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    throw ApiError.forbidden('NO_TENANT', 'Tenant context missing');
  }
  return { tenantId, ...extra };
}

function requireTenantContext(req) {
  if (!req.user?.tenantId) {
    throw ApiError.forbidden('NO_TENANT', 'This route requires a tenant context');
  }
  return req.user.tenantId;
}

module.exports = { tenantFilter, requireTenantContext };