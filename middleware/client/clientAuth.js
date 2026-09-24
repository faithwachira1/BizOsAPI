const { verifyAccessToken } = require('../../utils/jwt');
const { ApiError } = require('../../utils/apiError');

function clientAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) throw ApiError.unauthorized('NO_TOKEN', 'Missing access token');

  const payload = verifyAccessToken(token);

  if (payload.scope === 'platform' || payload.role === 'super_admin') {
    throw ApiError.forbidden('NOT_CLIENT', 'Client access required');
  }

  if (!['active', 'pending'].includes(payload.scope)) {
    throw ApiError.forbidden('INACTIVE', 'Account inactive');
  }

  req.user = {
    id: payload.sub,
    tenantId: payload.tenantId,
    role: payload.role,
    scope: payload.scope,
  };

  next();
}

module.exports = { clientAuth };