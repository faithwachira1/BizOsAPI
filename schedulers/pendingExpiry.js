const Tenant = require('../models/admin/Tenant');
const PendingActivation = require('../models/admin/PendingActivation');
const User = require('../models/client/User');
const emailService = require('../services/emailService');
const { logger } = require('../utils/logger');

const EXPIRE_DAYS = 14;
const REMIND_DAYS = 10;

async function runPendingExpiry() {
  const now = new Date();

  const remindBefore = new Date(now.getTime() - REMIND_DAYS * 24 * 60 * 60 * 1000);
  const expireBefore = new Date(now.getTime() - EXPIRE_DAYS * 24 * 60 * 60 * 1000);

  const toExpire = await Tenant.find({
    status: 'pending_user',
    registeredAt: { $lte: expireBefore },
  }).lean();

  for (const tenant of toExpire) {
    try {
      await Tenant.updateOne(
        { _id: tenant._id },
        { $set: { status: 'expired', expiresAt: now } }
      );

      await PendingActivation.updateOne(
        { tenantId: tenant._id },
        { $set: { status: 'expired', decision: 'expired', reviewedAt: now } }
      );

      const owner = await User.findOne({ tenantId: tenant._id, role: 'owner' }).select('email').lean();

      if (owner?.email) {
        emailService
          .sendPendingExpiredEmail(owner.email, {
            businessName: tenant.name,
          })
          .catch((e) => logger.error({ err: e.message }, 'pendingExpired email failed'));
      }

      logger.info({ tenantId: tenant._id }, 'pending tenant expired');
    } catch (err) {
      logger.error({ tenantId: tenant._id, err: err.message }, 'pendingExpiry failed');
    }
  }

  const toRemind = await Tenant.find({
    status: 'pending_user',
    registeredAt: { $lte: remindBefore, $gt: expireBefore },
  }).lean();

  for (const tenant of toRemind) {
    try {
      const owner = await User.findOne({ tenantId: tenant._id, role: 'owner' }).select('email').lean();
      if (!owner?.email) continue;

      emailService
        .sendPendingReminderEmail(owner.email, {
          businessName: tenant.name,
          daysLeft: EXPIRE_DAYS - REMIND_DAYS,
        })
        .catch((e) => logger.error({ err: e.message }, 'pendingReminder email failed'));
    } catch (err) {
      logger.error({ tenantId: tenant._id, err: err.message }, 'pendingReminder failed');
    }
  }
}

module.exports = { runPendingExpiry };