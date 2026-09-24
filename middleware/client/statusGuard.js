const { ApiError } = require('../../utils/apiError');

function requireActive(req, _res, next) {
  if (req.user?.scope !== 'active') {
    throw ApiError.forbidden('PENDING', 'Account not active');
  }
  next();
}

function allowPending(req, _res, next) {
  if (!['active', 'pending'].includes(req.user?.scope)) {
    throw ApiError.forbidden('INACTIVE', 'Account inactive');
  }
  next();
}

module.exports = { requireActive, allowPending };