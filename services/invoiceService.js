const crypto = require('crypto');
const Invoice = require('../models/client/Invoice');
const paymentInstructionsService = require('./paymentInstructionsService');
const { ApiError } = require('../utils/apiError');
const { logger } = require('../utils/logger');

const DUE_HOURS = 3;

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `INV-${year}${month}-${rand}`;
}

async function generateUniqueInvoiceNumber() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = generateInvoiceNumber();
    const exists = await Invoice.findOne({ invoiceNumber: number }).lean();
    if (!exists) return number;
  }
  throw ApiError.internal('INVOICE_NUMBER_FAILED', 'Could not generate unique invoice number');
}

function intervalLabel(interval) {
  if (interval === 'once') return 'One-time';
  if (interval === 'year') return 'Annual';
  return 'Monthly';
}

async function generateRegistrationInvoice({ tenantId, owner, tenant, plan }) {
  if (!tenantId || !owner) {
    throw ApiError.badRequest('MISSING_FIELDS', 'tenantId and owner required');
  }

  const price = plan?.price || { amount: 0, currency: 'KES', interval: 'month' };
  const planName = plan?.name || 'Free';
  const label = intervalLabel(price.interval);

  const invoiceNumber = await generateUniqueInvoiceNumber();
  const issuedAt = new Date();
  const dueDate = new Date(issuedAt.getTime() + DUE_HOURS * 60 * 60 * 1000);

  const items = [
    {
      productId: null,
      name: `BizOS ${planName} Plan`,
      description: `${label} · ${tenant.name}`,
      qty: 1,
      unitPrice: price.amount,
      subtotal: price.amount,
    },
  ];

  const subtotal = price.amount;
  const total = subtotal;

  const instructions = await paymentInstructionsService.getPaymentInstructions({
    amount: total,
    currency: price.currency,
    invoiceNumber,
  });

  const invoice = await Invoice.create({
    tenantId,
    invoiceNumber,
    customerId: null,
    customerSnapshot: {
      name: owner.fullName,
      email: owner.email,
      phone: owner.phone || null,
      address: null,
    },
    items,
    subtotal,
    discount: 0,
    tax: 0,
    total,
    amountPaid: 0,
    amountDue: total,
    currency: price.currency,
    status: 'sent',
    dueDate,
    issuedAt,
    sentAt: issuedAt,
    notes: `Registration invoice. Payment due within ${DUE_HOURS} hours to secure your account.`,
    paymentInstructions: instructions,
    createdBy: owner._id,
  });

  logger.info(
    {
      tenantId,
      invoiceNumber,
      total,
      dueDate,
      dueHours: DUE_HOURS,
      methodCount: instructions.length,
      planInterval: price.interval,
    },
    'registration invoice created'
  );

  return { invoice, instructions };
}

module.exports = {
  generateRegistrationInvoice,
  generateInvoiceNumber,
  generateUniqueInvoiceNumber,
  DUE_HOURS,
};