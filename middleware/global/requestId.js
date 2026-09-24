const { randomUUID } = require('crypto');

function requestId(req, _res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  next();
}

module.exports = { requestId };