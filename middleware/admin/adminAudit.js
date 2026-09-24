const AdminAction = require('../../models/admin/AdminAction');

function adminAudit(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  AdminAction.create({
    adminId: req.admin?.id,
    tenantId: req.params?.tenantId || req.body?.tenantId || null,
    action: `${req.method} ${req.originalUrl}`,
    metadata: {
      method: req.method,
      path: req.originalUrl,
      body: sanitizeBody(req.body),
    },
    ip: req.ip,
  }).catch((e) => console.error('[adminAudit] failed', e.message));

  next();
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return {};
  const clone = { ...body };
  delete clone.password;
  delete clone.passwordHash;
  delete clone.token;
  delete clone.refreshToken;
  return clone;
}

module.exports = { adminAudit };