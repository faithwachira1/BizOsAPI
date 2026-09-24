const Invoice = require('../models/client/Invoice');
const Tenant = require('../models/admin/Tenant');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const { getRedis } = require('../config/redis');
const { env } = require('../config/env');
const { logger } = require('../utils/logger');

const ESCALATION_DAYS = [7, 14, 30];

function daysBetween(a, b) {
  return Math.floor((a - b) / (24 * 60 * 60 * 1000));
}

async function alreadySentToday(invoiceId) {
  const redis = getRedis();
  if (!redis) return false;
  const key = `alert:overdue:${invoiceId}:${new Date().toISOString().slice(0, 10)}`;
  const exists = await redis.exists(key);
  if (exists) return true;
  await redis.set(key, '1', 'EX', 86400);
  return false;
}

async function runOverdueInvoices() {
  const now = new Date();

  const invoices = await Invoice.find({
    status: { $in: ['sent', 'partial'] },
    dueDate: { $lt: now },
  })
    .select('_id tenantId invoiceNumber total amountDue currency dueDate customerSnapshot remindersSent')
    .lean();

  for (const inv of invoices) {
    try {
      const daysOverdue = daysBetween(now, new Date(inv.dueDate));

      const shouldEscalate = ESCALATION_DAYS.some((d) => {
        if (daysOverdue === d) return true;
        if (daysOverdue > d && daysOverdue < d + 1 && !ESCALATION_DAYS.includes(daysOverdue)) return false;
        return false;
      });

      if (!shouldEscalate) continue;
      if (await alreadySentToday(inv._id)) continue;

      const tenant = await Tenant.findById(inv.tenantId).select('name').lean();
      const customer = inv.customerSnapshot || {};
      const shortUrl = `${env.appUrl}/pay/${inv._id}`;

      if (customer.email) {
        emailService
          .sendInvoiceOverdueEmail(customer.email, {
            businessName: tenant?.name || 'BizOS',
            customerName: customer.name,
            invoiceNumber: inv.invoiceNumber,
            total: inv.amountDue,
            currency: inv.currency,
            daysOverdue,
          })
          .catch((e) => logger.error({ err: e.message }, 'overdue email failed'));
      }

      if (customer.phone) {
        smsService
          .sendInvoiceOverdue(customer.phone, {
            invoiceNumber: inv.invoiceNumber,
            total: inv.amountDue,
            currency: inv.currency,
            daysOverdue,
            shortUrl,
          })
          .catch((e) => logger.error({ err: e.message }, 'overdue sms failed'));
      }

      await Invoice.updateOne(
        { _id: inv._id },
        {
          $set: { status: 'overdue', lastReminderAt: now },
          $inc: { remindersSent: 1 },
        }
      );
    } catch (err) {
      logger.error({ invoiceId: inv._id, err: err.message }, 'overdueInvoices failed');
    }
  }
}

module.exports = { runOverdueInvoices };