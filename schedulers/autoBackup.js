const PlatformSetting = require('../models/admin/PlatformSetting');
const backupService = require('../services/backupService');
const emailService = require('../services/emailService');
const { logger } = require('../utils/logger');

function shouldRun(freq, now) {
  if (freq === 'daily') return true;
  if (freq === 'weekly') return now.getDay() === 0;
  if (freq === 'monthly') return now.getDate() === 1;
  return false;
}

async function runAutoBackup() {
  const enabled = await PlatformSetting.getValue('backup_auto_enabled', false);
  if (!enabled) return;

  const freq = await PlatformSetting.getValue('backup_frequency', 'daily');
  const now = new Date();

  if (!shouldRun(freq, now)) return;

  try {
    const doc = await backupService.createBackup({ type: 'auto' });
    logger.info({ filename: doc.filename, sizeBytes: doc.sizeBytes }, 'autoBackup success');
  } catch (err) {
    logger.error({ err: err.message }, 'autoBackup failed');

    const notify = await PlatformSetting.getValue('backup_notify_on_fail', true);
    const emails = await PlatformSetting.getValue('backup_notify_emails', []);

    if (notify && emails.length) {
      for (const to of emails) {
        emailService
          .sendAdminBackupFailedEmail(to, { error: err.message, at: now.toISOString() })
          .catch((e) => logger.error({ err: e.message }, 'backupFail email failed'));
      }
    }
  }

  try {
    await backupService.cleanupExpired();
  } catch (err) {
    logger.error({ err: err.message }, 'cleanupExpired failed');
  }
}

module.exports = { runAutoBackup };