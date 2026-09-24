const { ApiError } = require('../../utils/apiError');

function tenantScope(req, _res, next) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) throw ApiError.forbidden('NO_TENANT', 'Tenant context required');
  req.tenantId = tenantId;
  next();
}

module.exports = { tenantScope };