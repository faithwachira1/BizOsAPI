const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, noContent } = require('../../utils/apiResponse');
const chatService = require('../../services/chatService');

const message = asyncHandler(async (req, res) => {
  const result = await chatService.reply({
    tenantId: req.tenantId,
    userId: req.user.id,
    text: req.body.text,
  });
  return ok(res, result);
});

const history = asyncHandler(async (req, res) => {
  const items = await chatService.history(req.tenantId, req.user.id, {
    limit: Number(req.query.limit) || 50,
  });
  return ok(res, items);
});

const clear = asyncHandler(async (req, res) => {
  await chatService.clear(req.tenantId, req.user.id);
  return noContent(res);
});

module.exports = { message, history, clear };