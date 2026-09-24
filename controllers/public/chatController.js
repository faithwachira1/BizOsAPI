const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const publicChatService = require('../../services/publicChatService');

const message = asyncHandler(async (req, res) => {
  const result = await publicChatService.reply({
    text: req.body.text,
    ip: req.ip,
  });
  return ok(res, result);
});

module.exports = { message };