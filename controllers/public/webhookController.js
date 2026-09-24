const { asyncHandler } = require('../../utils/asyncHandler');
const { logger } = require('../../utils/logger');
const mpesaService = require('../../services/mpesaService');
const emailService = require('../../services/emailService');
const Payment = require('../../models/client/Payment');
const Sale = require('../../models/client/Sale');
const Invoice = require('../../models/client/Invoice');
const Tenant = require('../../models/admin/Tenant');
const User = require('../../models/client/User');

async function notifyInvoicePaid(invoice, method, reference) {
  try {
    const tenant = await Tenant.findById(invoice.tenantId).lean();
    const owner = await User.findOne({ tenantId: invoice.tenantId, role: 'owner' })
      .select('email fullName')
      .lean();

    if (!owner?.email) return;

    await emailService.sendPaymentReceivedEmail(owner.email, {
      businessName: tenant?.name || 'BizOS',
      customerName: owner.fullName,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amountPaid,
      currency: invoice.currency,
      paidAt: invoice.paidAt?.toISOString() || new Date().toISOString(),
      paymentMethod: method,
      paymentReference: reference || null,
      notes: null,
    });

    logger.info(
      { invoiceNumber: invoice.invoiceNumber, method, reference },
      'paymentReceived email sent (callback)'
    );
  } catch (err) {
    logger.error({ err: err.message, invoiceNumber: invoice.invoiceNumber }, 'paymentReceived email failed');
  }
}

const mpesaCallback = asyncHandler(async (req, res) => {
  const payload = req.body;
  const parsed = mpesaService.parseCallback(payload);

  if (parsed.checkoutRequestId) {
    const payment = await Payment.findOne({ providerRef: parsed.checkoutRequestId });
    if (payment) {
      payment.status = parsed.success ? 'success' : 'failed';
      payment.providerPayload = payload;
      if (parsed.success && parsed.mpesaReceiptNumber) {
        payment.providerRef = parsed.mpesaReceiptNumber;
      }
      await payment.save();

      if (parsed.success && payment.saleId) {
        await Sale.updateOne({ _id: payment.saleId }, { $set: { paymentStatus: 'paid' } });
      }
    }

    const invoice = await Invoice.findOne({
      'stkLastRequest.checkoutRequestId': parsed.checkoutRequestId,
    });

    if (invoice && parsed.success) {
      const paidAt = new Date();

      invoice.status = 'paid';
      invoice.amountPaid = invoice.amountDue;
      invoice.amountDue = 0;
      invoice.paidAt = paidAt;
      invoice.paymentMethod = 'mpesa_stk';
      invoice.paymentRef = parsed.mpesaReceiptNumber || null;
      await invoice.save();

      logger.info(
        {
          invoiceNumber: invoice.invoiceNumber,
          receipt: parsed.mpesaReceiptNumber,
          amount: parsed.amount,
        },
        'invoice paid via STK callback'
      );

      notifyInvoicePaid(invoice, 'mpesa_stk', parsed.mpesaReceiptNumber).catch(() => {});
    } else if (invoice && !parsed.success) {
      logger.warn(
        {
          invoiceNumber: invoice.invoiceNumber,
          resultDesc: parsed.resultDesc,
        },
        'STK payment failed'
      );
    }
  }

  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

const mpesaTimeout = asyncHandler(async (req, res) => {
  logger.warn({ body: req.body }, 'mpesa timeout');
  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

const stripeWebhook = asyncHandler(async (req, res) => {
  logger.info('stripe webhook received');
  return res.status(200).json({ received: true });
});

const paystackWebhook = asyncHandler(async (req, res) => {
  logger.info('paystack webhook received');
  return res.status(200).json({ received: true });
});

const flutterwaveWebhook = asyncHandler(async (req, res) => {
  logger.info('flutterwave webhook received');
  return res.status(200).json({ received: true });
});

module.exports = {
  mpesaCallback,
  mpesaTimeout,
  stripeWebhook,
  paystackWebhook,
  flutterwaveWebhook,
};