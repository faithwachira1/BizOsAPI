const { ApiError } = require('../../utils/apiError');
const { logger } = require('../../utils/logger');
const { env } = require('../../config/env');

function errorHandler(err, req, res, _next) {
  let statusCode = 500;
  let code = 'INTERNAL';
  let message = 'Internal server error';
  let details = null;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE';
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `Duplicate value for ${field}`;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token expired';
  }

  if (statusCode >= 500) {
    logger.error({ err: err.message, stack: err.stack, requestId: req.id }, 'unhandled');
  } else {
    logger.warn({ code, message, requestId: req.id }, 'handled error');
  }

  const body = {
    success: false,
    error: { code, message },
  };

  if (details) body.error.details = details;
  if (!env.isProd && statusCode >= 500) body.error.stack = err.stack;

  res.status(statusCode).json(body);
}

module.exports = { errorHandler };