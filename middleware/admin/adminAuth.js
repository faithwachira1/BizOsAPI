const { verifyAccessToken } = require('../../utils/jwt');
const { ApiError } = require('../../utils/apiError');

function adminAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) throw ApiError.unauthorized('NO_TOKEN', 'Missing access token');

  const payload = verifyAccessToken(token);

  if (payload.scope !== 'platform' || payload.role !== 'super_admin') {
    throw ApiError.forbidden('NOT_ADMIN', 'Platform access required');
  }

  req.admin = {
    id: payload.sub,
    role: payload.role,
    scope: payload.scope,
  };

  next();
}

module.exports = { adminAuth };