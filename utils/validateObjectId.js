const mongoose = require('mongoose');
const { ApiError } = require('./apiError');

function assertObjectId(id, field = 'id') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('INVALID_ID', `${field} is not a valid id`);
  }
  return id;
}

module.exports = { assertObjectId };