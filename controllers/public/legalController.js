const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const legalService = require('../../services/legalService');

const getCurrent = asyncHandler(async (req, res) => {
  const doc = await legalService.getCurrent(req.params.type);
  return ok(res, doc);
});

module.exports = { getCurrent };