const { ApiError } = require('../../utils/apiError');

function roles(...allowed) {
  return (req, _res, next) => {
    if (!allowed.includes(req.user?.role)) {
      throw ApiError.forbidden('ROLE', 'Insufficient role');
    }
    next();
  };
}

module.exports = { roles };