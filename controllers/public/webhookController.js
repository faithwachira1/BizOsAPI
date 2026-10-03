const { asyncHandler } = require('../../utils/asyncHandler');
const { logger } = require('../../utils/logger');
const mpesaService = require('../../services/mpesaService');
const emailService = require('../../services/emailService');
const Payment = require('../../models/client/Payment');
const Sale = require('../../models/client/Sale');
const Invoice = require('../../models/client/Invoice');
const Tenant = require('../../models/admin/Tenant');
const User = require('../../models/client/User');

function coerceBody(body) {
  if (!body) return {};

  if (typeof body === 'object' && body.Body) return body;

  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch {
      return {};
    }
  }

  if (typeof body === 'object' && body[0] !== undefined) {
    try {
      const buf = Buffer.from(Object.values(body));
      return JSON.parse(buf.toString('utf8'));
    } catch {
      return {};
    }
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }

  return body;
}

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
    logger.error(
      { err: err.message, invoiceNumber: invoice.invoiceNumber },
      'paymentReceived email failed'
    );
  }
}

async function handleSalePayment(payment, parsed) {
  if (!payment.saleId) return;

  await Sale.updateOne(
    { _id: payment.saleId },
    {
      $set: {
        paymentStatus: parsed.success ? 'paid' : 'failed',
        paidAt: parsed.success ? new Date() : null,
      },
    }
  );

  logger.info(
    {
      saleId: String(payment.saleId),
      success: parsed.success,
      receipt: parsed.mpesaReceiptNumber,
    },
    'STK callback: sale updated'
  );
}

async function handleInvoicePayment(payment, parsed) {
  let invoice = null;

  if (payment.invoiceId) {
    invoice = await Invoice.findById(payment.invoiceId);
  }

  if (!invoice) {
    invoice = await Invoice.findOne({
      'stkLastRequest.checkoutRequestId': parsed.checkoutRequestId,
    });
  }

  if (!invoice) {
    logger.error(
      { checkoutRequestId: parsed.checkoutRequestId },
      'STK callback: invoice not found'
    );
    return;
  }

  if (parsed.success) {
    invoice.status = 'paid';
    invoice.amountPaid = invoice.total;
    invoice.amountDue = 0;
    invoice.paidAt = new Date();
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
  } else {
    logger.warn(
      { invoiceNumber: invoice.invoiceNumber, resultDesc: parsed.resultDesc },
      'STK payment failed for invoice'
    );
  }
}

const mpesaCallback = asyncHandler(async (req, res) => {
  const payload = coerceBody(req.body);
  const parsed = mpesaService.parseCallback(payload);

  logger.info(
    {
      checkoutRequestId: parsed.checkoutRequestId,
      success: parsed.success,
      resultCode: parsed.resultCode,
      resultDesc: parsed.resultDesc,
      receipt: parsed.mpesaReceiptNumber,
    },
    'mpesa callback parsed'
  );

  if (!parsed.checkoutRequestId) {
    logger.warn(
      { contentType: req.headers['content-type'], payload },
      'mpesa callback: no checkoutRequestId'
    );
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  if (mpesaService.isDuplicateCallback(parsed.checkoutRequestId)) {
    logger.warn(
      { checkoutRequestId: parsed.checkoutRequestId },
      'duplicate mpesa callback ignored'
    );
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const payment = await Payment.findOne({
    $or: [
      { providerRef: parsed.checkoutRequestId },
      { mpesaReceipt: parsed.checkoutRequestId },
    ],
  });

  if (payment) {
    const wasAlreadyFinal = payment.status === 'success' || payment.status === 'failed';

    payment.status = parsed.success ? 'success' : 'failed';
    payment.providerPayload = payload;

    if (parsed.success) {
      payment.mpesaReceipt = parsed.mpesaReceiptNumber || null;
      payment.paidAt = new Date();
    } else {
      payment.failureReason = parsed.resultDesc || null;
    }

    await payment.save();

    if (wasAlreadyFinal) {
      logger.warn(
        { paymentId: String(payment._id), status: payment.status },
        'payment was already final — skipping handler'
      );
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    try {
      if (payment.purpose === 'invoice') {
        await handleInvoicePayment(payment, parsed);
      } else {
        await handleSalePayment(payment, parsed);
      }
    } catch (err) {
      logger.error(
        {
          err: err.message,
          paymentId: String(payment._id),
          purpose: payment.purpose,
        },
        'STK callback dispatch failed'
      );
    }
  } else {
    const invoice = await Invoice.findOne({
      'stkLastRequest.checkoutRequestId': parsed.checkoutRequestId,
    });

    if (invoice) {
      logger.warn(
        { invoiceNumber: invoice.invoiceNumber },
        'STK callback: no payment row, recovering via invoice'
      );
      await handleInvoicePayment(
        { invoiceId: invoice._id, tenantId: invoice.tenantId },
        parsed
      );
    } else {
      logger.error(
        { checkoutRequestId: parsed.checkoutRequestId, payload },
        'STK callback: no matching payment or invoice'
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