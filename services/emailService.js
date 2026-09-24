const { hdmBridge, HDM_BRIDGE_ENDPOINTS, mailFrom } = require('../config/hdmBridge');
const { emailTemplates } = require('../templates/emailTemplates');
const { getBrand } = require('./brandService');
const { ApiError } = require('../utils/apiError');
const { logger } = require('../utils/logger');

function mask(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return '[redacted]';
  return `${user.slice(0, 1)}***@${domain}`;
}

async function sendMail({ to, subject, html, text }) {
  try {
    await hdmBridge.post(HDM_BRIDGE_ENDPOINTS.SEND_EMAIL, {
      from: mailFrom.email,
      fromName: mailFrom.name,
      to,
      subject,
      htmlBody: html,
      textBody: text,
    });
    logger.info({ to: mask(to), subject }, 'email sent');
    return { sent: true };
  } catch (err) {
    logger.error({ err: err.message, to: mask(to) }, 'email failed');
    throw ApiError.badRequest('EMAIL_FAILED', 'Could not send email');
  }
}

async function render(name, data) {
  const brand = await getBrand();
  const template = emailTemplates[name];
  if (!template) throw ApiError.internal('TEMPLATE_MISSING', `Template '${name}' not found`);
  return template({ ...data, brand });
}

async function sendVerificationEmail(to, data) {
  return sendMail({ to, ...(await render('verification', data)) });
}
async function sendPasswordResetEmail(to, data) {
  return sendMail({ to, ...(await render('passwordReset', data)) });
}
async function sendPasswordChangedEmail(to, data) {
  return sendMail({ to, ...(await render('passwordChanged', data)) });
}
async function sendRegistrationReceivedEmail(to, data) {
  return sendMail({ to, ...(await render('registrationReceived', data)) });
}
async function sendWelcomeEmail(to, data) {
  return sendMail({ to, ...(await render('welcome', data)) });
}
async function sendRejectionEmail(to, data) {
  return sendMail({ to, ...(await render('rejection', data)) });
}
async function sendPendingReminderEmail(to, data) {
  return sendMail({ to, ...(await render('pendingReminder', data)) });
}
async function sendPendingExpiredEmail(to, data) {
  return sendMail({ to, ...(await render('pendingExpired', data)) });
}
async function sendStaffWelcomeEmail(to, data) {
  return sendMail({ to, ...(await render('staffWelcome', data)) });
}
async function sendStaffDeactivatedEmail(to, data) {
  return sendMail({ to, ...(await render('staffDeactivated', data)) });
}
async function sendRoleChangedEmail(to, data) {
  return sendMail({ to, ...(await render('roleChanged', data)) });
}
async function sendLowStockEmail(to, data) {
  return sendMail({ to, ...(await render('lowStockAlert', data)) });
}
async function sendOutOfStockEmail(to, data) {
  return sendMail({ to, ...(await render('outOfStock', data)) });
}
async function sendDailySummaryEmail(to, data) {
  return sendMail({ to, ...(await render('dailySummary', data)) });
}
async function sendWeeklyReportEmail(to, data) {
  return sendMail({ to, ...(await render('weeklyReport', data)) });
}
async function sendSubscriptionPaidEmail(to, data) {
  return sendMail({ to, ...(await render('subscriptionPaid', data)) });
}
async function sendSubscriptionExpiringEmail(to, data) {
  return sendMail({ to, ...(await render('subscriptionExpiring', data)) });
}
async function sendSubscriptionExpiredEmail(to, data) {
  return sendMail({ to, ...(await render('subscriptionExpired', data)) });
}
async function sendSubscriptionFailedEmail(to, data) {
  return sendMail({ to, ...(await render('subscriptionFailed', data)) });
}
async function sendPlanUpgradedEmail(to, data) {
  return sendMail({ to, ...(await render('planUpgraded', data)) });
}
async function sendPlanCancelledEmail(to, data) {
  return sendMail({ to, ...(await render('planCancelled', data)) });
}
async function sendPurchaseOrderEmail(to, data) {
  return sendMail({ to, ...(await render('purchaseOrder', data)) });
}
async function sendPurchaseOrderCancelledEmail(to, data) {
  return sendMail({ to, ...(await render('purchaseOrderCancelled', data)) });
}
async function sendInvoiceEmail(to, data) {
  return sendMail({ to, ...(await render('invoice', data)) });
}
async function sendInvoiceReminderEmail(to, data) {
  return sendMail({ to, ...(await render('invoiceReminder', data)) });
}
async function sendInvoicePaidEmail(to, data) {
  return sendMail({ to, ...(await render('invoicePaid', data)) });
}
async function sendInvoiceOverdueEmail(to, data) {
  return sendMail({ to, ...(await render('invoiceOverdue', data)) });
}
async function sendInvoiceCancelledEmail(to, data) {
  return sendMail({ to, ...(await render('invoiceCancelled', data)) });
}
async function sendPaymentReceivedEmail(to, data) {
  return sendMail({ to, ...(await render('paymentReceived', data)) });
}
async function sendAdminNewPendingEmail(to, data) {
  return sendMail({ to, ...(await render('adminNewPending', data)) });
}
async function sendAdminPendingDigestEmail(to, data) {
  return sendMail({ to, ...(await render('adminPendingDigest', data)) });
}
async function sendAdminServiceDownEmail(to, data) {
  return sendMail({ to, ...(await render('adminServiceDown', data)) });
}
async function sendAdminBackupFailedEmail(to, data) {
  return sendMail({ to, ...(await render('adminBackupFailed', data)) });
}
async function sendAdminRestoreCompleteEmail(to, data) {
  return sendMail({ to, ...(await render('adminRestoreComplete', data)) });
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendRegistrationReceivedEmail,
  sendWelcomeEmail,
  sendRejectionEmail,
  sendPendingReminderEmail,
  sendPendingExpiredEmail,
  sendStaffWelcomeEmail,
  sendStaffDeactivatedEmail,
  sendRoleChangedEmail,
  sendLowStockEmail,
  sendOutOfStockEmail,
  sendDailySummaryEmail,
  sendWeeklyReportEmail,
  sendSubscriptionPaidEmail,
  sendSubscriptionExpiringEmail,
  sendSubscriptionExpiredEmail,
  sendSubscriptionFailedEmail,
  sendPlanUpgradedEmail,
  sendPlanCancelledEmail,
  sendPurchaseOrderEmail,
  sendPurchaseOrderCancelledEmail,
  sendInvoiceEmail,
  sendInvoiceReminderEmail,
  sendInvoicePaidEmail,
  sendInvoiceOverdueEmail,
  sendInvoiceCancelledEmail,
  sendPaymentReceivedEmail,
  sendAdminNewPendingEmail,
  sendAdminPendingDigestEmail,
  sendAdminServiceDownEmail,
  sendAdminBackupFailedEmail,
  sendAdminRestoreCompleteEmail,
};