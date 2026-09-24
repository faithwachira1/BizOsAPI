const { asyncHandler } = require('../../utils/asyncHandler');
const { ok, created, paginated, noContent } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { assertObjectId } = require('../../utils/validateObjectId');
const backupService = require('../../services/backupService');
const emailService = require('../../services/emailService');
const SuperAdmin = require('../../models/admin/SuperAdmin');

const list = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { items, total } = await backupService.listBackups({
    page,
    limit,
    status: req.query.status,
  });
  return paginated(res, items, page, limit, total);
});

const createNow = asyncHandler(async (req, res) => {
  const doc = await backupService.createBackup({
    type: 'manual',
    triggeredBy: req.admin.id,
  });
  return created(res, doc);
});

const get = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'backupId');
  const doc = await backupService.getBackup(req.params.id);
  return ok(res, doc);
});

const download = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'backupId');
  const { url } = await backupService.getDownloadUrl(req.params.id);
  return ok(res, { url });
});

const sendEmail = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'backupId');
  const result = await backupService.sendBackupByEmail(req.params.id, req.body.to);
  return ok(res, result);
});

const restore = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'backupId');

  const result = await backupService.restoreBackup(req.params.id, {
    confirm: req.body.confirm === true,
  });

  const admins = await SuperAdmin.find({ status: 'active' }).select('email').lean();
  for (const a of admins) {
    emailService
      .sendAdminRestoreCompleteEmail(a.email, {
        filename: result.restored,
        collections: result.collections,
        at: result.at,
      })
      .catch(() => {});
  }

  return ok(res, result);
});

const remove = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'backupId');
  await backupService.deleteBackup(req.params.id);
  return noContent(res);
});

module.exports = {
  list,
  createNow,
  get,
  download,
  sendEmail,
  restore,
  remove,
};