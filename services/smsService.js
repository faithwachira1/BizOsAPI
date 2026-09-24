const { brevo, brevoSender } = require('../config/brevo');
const { smsTemplates } = require('../templates/smsTemplates');
const { ApiError } = require('../utils/apiError');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');

function mask(phone) {
  const s = String(phone);
  if (s.length < 6) return '[redacted]';
  return `${s.slice(0, 4)}***${s.slice(-2)}`;
}

function normalizePhone(phone) {
  let s = String(phone).replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (s.startsWith('0')) s = `+254${s.slice(1)}`;
  if (!s.startsWith('+')) s = `+${s}`;
  return s;
}

async function sendSms(to, content, type = 'transactional') {
  if (!env.brevo.enabled) {
    logger.warn({ to: mask(to) }, 'sms skipped: brevo disabled');
    return { skipped: true };
  }

  const recipient = normalizePhone(to);

  try {
    await brevo.post('/transactionalSMS/sms', {
      sender: brevoSender,
      recipient,
      content,
      type,
    });
    logger.info({ to: mask(to), type }, 'sms sent');
    return { sent: true };
  } catch (err) {
    logger.error({ err: err.message, to: mask(to) }, 'sms failed');
    throw ApiError.badRequest('SMS_FAILED', 'Could not send SMS');
  }
}

async function sendOtp(to, data) {
  return sendSms(to, smsTemplates.otp(data));
}

async function sendApproval(to, data) {
  return sendSms(to, smsTemplates.approval(data));
}

async function sendRejection(to, data) {
  return sendSms(to, smsTemplates.rejection(data));
}

async function sendLowStockAlert(to, data) {
  return sendSms(to, smsTemplates.lowStockAlert(data));
}

async function sendOutOfStock(to, data) {
  return sendSms(to, smsTemplates.outOfStock(data));
}

async function sendDailySummary(to, data) {
  return sendSms(to, smsTemplates.dailySummary(data));
}

async function sendSubscriptionPaid(to, data) {
  return sendSms(to, smsTemplates.subscriptionPaid(data));
}

async function sendSubscriptionExpiring(to, data) {
  return sendSms(to, smsTemplates.subscriptionExpiring(data));
}

async function sendSubscriptionExpired(to, data) {
  return sendSms(to, smsTemplates.subscriptionExpired(data));
}

async function sendSubscriptionFailed(to, data) {
  return sendSms(to, smsTemplates.subscriptionFailed(data));
}

async function sendAdminServiceDown(to, data) {
  return sendSms(to, smsTemplates.adminServiceDown(data));
}

async function sendInvoice(to, data) {
  return sendSms(to, smsTemplates.invoice(data));
}

async function sendInvoiceReminder(to, data) {
  return sendSms(to, smsTemplates.invoiceReminder(data));
}

async function sendInvoiceOverdue(to, data) {
  return sendSms(to, smsTemplates.invoiceOverdue(data));
}

module.exports = {
  sendSms,
  sendOtp,
  sendApproval,
  sendRejection,
  sendLowStockAlert,
  sendOutOfStock,
  sendDailySummary,
  sendSubscriptionPaid,
  sendSubscriptionExpiring,
  sendSubscriptionExpired,
  sendSubscriptionFailed,
  sendAdminServiceDown,
  sendInvoice,
  sendInvoiceReminder,
  sendInvoiceOverdue,
};