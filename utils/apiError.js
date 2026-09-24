class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(code, message, details) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(code = 'UNAUTHORIZED', message = 'Unauthorized') {
    return new ApiError(401, code, message);
  }

  static forbidden(code = 'FORBIDDEN', message = 'Forbidden') {
    return new ApiError(403, code, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Not found') {
    return new ApiError(404, code, message);
  }

  static conflict(code, message, details) {
    return new ApiError(409, code, message, details);
  }

  static tooMany(code = 'RATE_LIMITED', message = 'Too many requests') {
    return new ApiError(429, code, message);
  }

  static internal(code = 'INTERNAL', message = 'Internal server error') {
    return new ApiError(500, code, message);
  }
}

module.exports = { ApiError };