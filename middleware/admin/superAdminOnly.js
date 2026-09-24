const { ApiError } = require('../../utils/apiError');

function superAdminOnly(req, _res, next) {
  if (req.admin?.role !== 'super_admin') {
    throw ApiError.forbidden('ROLE', 'Super admin only');
  }
  next();
}

module.exports = { superAdminOnly };