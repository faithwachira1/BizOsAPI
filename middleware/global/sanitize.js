const { stripMongoOperators, sanitizeString } = require('../../utils/sanitize');

function sanitize(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = stripMongoOperators(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    }
  }

  next();
}

module.exports = { sanitize };