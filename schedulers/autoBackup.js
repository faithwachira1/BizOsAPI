const backupService = require('../services/backupService');
const emailService = require('../services/emailService');
const { logger } = require('../utils/logger');

function shouldRunHourly(cfg, now) {
  return cfg.frequency === 'hourly' && now.getMinutes() === cfg.minute;
}

function shouldRunFixed(cfg, now) {
  if (cfg.frequency === 'hourly') return false;
  if (now.getHours() !== cfg.hour) return false;
  if (now.getMinutes() !== cfg.minute) return false;

  if (cfg.frequency === 'daily') return true;
  if (cfg.frequency === 'weekly') return now.getDay() === cfg.dayOfWeek;
  if (cfg.frequency === 'monthly') return now.getDate() === cfg.dayOfMonth;
  return false;
}

function humanBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function runAutoBackup() {
  const cfg = await backupService.getSchedulerConfig();
  if (!cfg.enabled) return { skipped: 'disabled' };

  const now = new Date();
  const due = shouldRunHourly(cfg, now) || shouldRunFixed(cfg, now);
  if (!due) return { skipped: 'not-due' };

  const recent = await backupService.findRecentAutoBackup(60 * 1000);
  if (recent) {
    logger.warn(
      { backupId: recent._id, startedAt: recent.startedAt },
      'autoBackup skipped — recent run exists'
    );
    return { skipped: 'duplicate' };
  }

  logger.info({ frequency: cfg.frequency, at: now.toISOString() }, 'autoBackup starting');

  let doc;
  try {
    doc = await backupService.createBackup({ type: 'auto' });
    logger.info(
      { filename: doc.filename, sizeBytes: doc.sizeBytes, durationMs: doc.durationMs },
      'autoBackup success'
    );
  } catch (err) {
    logger.error({ err: err.message }, 'autoBackup failed');

    if (cfg.emailOnFailure && cfg.emailTo.length) {
      for (const to of cfg.emailTo) {
        emailService
          .sendAdminBackupFailedEmail(to, { error: err.message, at: now.toISOString() })
          .catch((e) => logger.error({ err: e.message }, 'backupFail email failed'));
      }
    }
    return { failed: err.message };
  }

  if (cfg.emailOnSuccess && cfg.emailTo.length) {
    for (const to of cfg.emailTo) {
      emailService
        .sendAdminBackupSuccessEmail(to, {
          filename: doc.filename,
          sizeBytes: doc.sizeBytes,
          sizeHuman: humanBytes(doc.sizeBytes),
          durationMs: doc.durationMs,
          collections: doc.collections,
          at: doc.completedAt?.toISOString() || new Date().toISOString(),
          downloadUrl: doc.url || null,
        })
        .catch((e) => logger.error({ err: e.message }, 'backupSuccess email failed'));
    }
  }

  try {
    await backupService.cleanupExpired();
  } catch (err) {
    logger.error({ err: err.message }, 'cleanupExpired failed');
  }

  return { ok: true, filename: doc.filename };
}

module.exports = { runAutoBackup, shouldRunFixed, shouldRunHourly };