const { logger, childLogger } = require('../../utils/logger');

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function statusColor(code) {
  if (code >= 500) return C.red;
  if (code >= 400) return C.yellow;
  if (code >= 300) return C.cyan;
  return C.green;
}

function requestLogger(req, res, next) {
  const start = Date.now();
  const log = childLogger(req);

  res.on('finish', () => {
    const ms = Date.now() - start;
    const code = res.statusCode;
    const color = statusColor(code);

    log.info(
      `${color}${code}${C.reset} ${C.dim}${req.method}${C.reset} ${req.originalUrl} ${C.dim}·${C.reset} ${ms}ms`
    );
  });

  next();
}

module.exports = { requestLogger };