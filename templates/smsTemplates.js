const PREFIX = 'BizOS:';

const otp = ({ code, minutes = 10 }) =>
  `${PREFIX} Your verification code is ${code}. Expires in ${minutes} min. Do not share.`;

const approval = ({ businessName, shortUrl }) =>
  `${PREFIX} ${businessName} is approved. Log in: ${shortUrl}`;

const rejection = ({ businessName }) =>
  `${PREFIX} Registration for ${businessName} was not approved. Check email for details.`;

const lowStockAlert = ({ productName, qty }) =>
  `${PREFIX} ${productName} is low (${qty} left). Reorder soon.`;

const outOfStock = ({ productName }) =>
  `${PREFIX} ${productName} is out of stock. Restock soon.`;

const dailySummary = ({ date, sales, total, currency, topProduct }) =>
  `${PREFIX} ${date}: ${sales} sales, ${currency}${total}.${topProduct ? ` Top: ${topProduct}.` : ''}`;

const subscriptionPaid = ({ planName, amount, currency }) =>
  `${PREFIX} Payment received. ${planName} · ${currency}${amount}. Thank you.`;

const subscriptionExpiring = ({ planName, daysLeft }) =>
  `${PREFIX} ${planName} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to avoid interruption.`;

const subscriptionExpired = ({ planName }) =>
  `${PREFIX} ${planName} has expired. Renew to restore access.`;

const subscriptionFailed = ({ planName, currency, amount }) =>
  `${PREFIX} Payment failed for ${planName} (${currency}${amount}). Update payment to avoid interruption.`;

const adminServiceDown = ({ service }) =>
  `${PREFIX} ALERT: ${service} is down. Check admin panel.`;

const invoice = ({ businessName, invoiceNumber, total, currency, dueDate, shortUrl }) =>
  `${PREFIX} Invoice ${invoiceNumber} from ${businessName}: ${currency}${total}. Due ${dueDate}. View: ${shortUrl}`;

const invoiceReminder = ({ invoiceNumber, total, currency, shortUrl }) =>
  `${PREFIX} Reminder: Invoice ${invoiceNumber} (${currency}${total}) is unpaid. Pay: ${shortUrl}`;

const invoiceOverdue = ({ invoiceNumber, total, currency, daysOverdue, shortUrl }) =>
  `${PREFIX} Invoice ${invoiceNumber} is ${daysOverdue} days overdue (${currency}${total}). Pay now: ${shortUrl}`;

const paymentReceived = ({ invoiceNumber, amount, currency, shortUrl }) =>
  `${PREFIX} Payment received for ${invoiceNumber} (${currency}${amount}). Thank you.${shortUrl ? ` ${shortUrl}` : ''}`;

module.exports = {
  smsTemplates: {
    otp,
    approval,
    rejection,
    lowStockAlert,
    outOfStock,
    dailySummary,
    subscriptionPaid,
    subscriptionExpiring,
    subscriptionExpired,
    subscriptionFailed,
    adminServiceDown,
    invoice,
    invoiceReminder,
    invoiceOverdue,
    paymentReceived,
  },
};