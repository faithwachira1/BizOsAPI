const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, noContent } = require('../../utils/apiResponse');
const { assertObjectId } = require('../../utils/validateObjectId');
const legalService = require('../../services/legalService');

const TYPES = ['terms', 'privacy', 'dpa', 'refund', 'aup'];

const list = asyncHandler(async (req, res) => {
  const { type } = req.query;

  if (type) {
    const docs = await legalService.listByType(type);
    return ok(res, docs);
  }

  const all = {};
  for (const t of TYPES) all[t] = await legalService.listByType(t);
  return ok(res, all);
});

const getByType = asyncHandler(async (req, res) => {
  const docs = await legalService.listByType(req.params.type);
  return ok(res, docs);
});

const getCurrent = asyncHandler(async (req, res) => {
  const doc = await legalService.getCurrent(req.params.type);
  return ok(res, doc);
});

const getByVersion = asyncHandler(async (req, res) => {
  const doc = await legalService.getByVersion(req.params.type, req.params.version);
  return ok(res, doc);
});

const publish = asyncHandler(async (req, res) => {
  const doc = await legalService.publish({
    type: req.params.type,
    title: req.body.title,
    content: req.body.content,
    effectiveAt: req.body.effectiveAt,
    adminId: req.admin.id,
  });
  return created(res, doc);
});

const update = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'legalId');
  const doc = await legalService.updateDraft(req.params.id, req.body);
  return ok(res, doc);
});

const remove = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'legalId');
  await legalService.removeDraft(req.params.id);
  return noContent(res);
});

module.exports = {
  list,
  getByType,
  getCurrent,
  getByVersion,
  publish,
  update,
  remove,
};