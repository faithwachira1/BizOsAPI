const PaymentMethod = require('../models/admin/PaymentMethod');
const { logger } = require('../utils/logger');

const PUBLIC_FIELDS = {
  cash: ['name'],
  mpesa_send: ['phone', 'name'],
  mpesa_till: ['tillNumber', 'name'],
  mpesa_paybill: ['paybillNumber', 'accountNumber', 'name'],
  bank: ['bankName', 'accountName', 'accountNumber', 'branch', 'swift'],
  stripe: ['publishableKey'],
  mpesa_stk: ['shortcode', 'name'],
};

function sanitizeConfig(code, config = {}) {
  const allowed = PUBLIC_FIELDS[code] || [];
  const out = {};
  for (const key of allowed) {
    if (config[key] !== undefined && config[key] !== null && config[key] !== '') {
      out[key] = config[key];
    }
  }
  return out;
}

function buildInstructions(method, { amount, currency, invoiceNumber }) {
  const c = method.config || {};

  switch (method.code) {
    case 'mpesa_stk':
      return {
        code: 'mpesa_stk',
        mode: 'auto',
        title: 'M-Pesa STK Push',
        description: 'Enter your M-Pesa phone number and we\'ll send a payment prompt to your phone.',
        action: {
          type: 'stk',
          label: 'Send STK to my phone',
          phoneField: true,
        },
      };

    case 'cash':
      return {
        code: 'cash',
        mode: 'manual',
        title: 'Cash',
        description: 'Pay in cash at our office.',
        steps: [
          'Visit our office during business hours',
          `Mention invoice ${invoiceNumber}`,
          `Pay ${currency} ${amount}`,
          'Request a receipt for your records',
        ],
      };

    case 'mpesa_send':
      return {
        code: 'mpesa_send',
        mode: 'manual',
        title: 'M-Pesa Send Money',
        description: 'Send money directly to our number.',
        steps: [
          'Go to M-Pesa menu on your phone',
          'Select "Send Money"',
          `Enter number: ${c.phone || '[not configured]'}`,
          `Enter amount: ${currency} ${amount}`,
          `Enter your M-Pesa PIN and confirm`,
          `Enter "${invoiceNumber}" as the reason if prompted`,
          'Keep the M-Pesa confirmation code — you\'ll need it to verify',
        ],
        recipient: {
          phone: c.phone || null,
          name: c.name || null,
        },
      };

    case 'mpesa_till':
      return {
        code: 'mpesa_till',
        mode: 'manual',
        title: 'M-Pesa Buy Goods (Till)',
        description: 'Pay via our Buy Goods till number.',
        steps: [
          'Go to M-Pesa menu on your phone',
          'Select "Lipa na M-Pesa"',
          'Select "Buy Goods and Services"',
          `Enter till number: ${c.tillNumber || '[not configured]'}`,
          `Enter amount: ${currency} ${amount}`,
          'Enter your M-Pesa PIN and confirm',
          'Keep the M-Pesa confirmation code — you\'ll need it to verify',
        ],
        recipient: {
          tillNumber: c.tillNumber || null,
          name: c.name || null,
        },
      };

    case 'mpesa_paybill':
      return {
        code: 'mpesa_paybill',
        mode: 'manual',
        title: 'M-Pesa Paybill',
        description: 'Pay via our Paybill number.',
        steps: [
          'Go to M-Pesa menu on your phone',
          'Select "Lipa na M-Pesa"',
          'Select "Pay Bill"',
          `Enter business number: ${c.paybillNumber || '[not configured]'}`,
          `Enter account number: ${c.accountNumber === '{invoice_number}' ? invoiceNumber : (c.accountNumber || invoiceNumber)}`,
          `Enter amount: ${currency} ${amount}`,
          'Enter your M-Pesa PIN and confirm',
          'Keep the M-Pesa confirmation code — you\'ll need it to verify',
        ],
        recipient: {
          paybillNumber: c.paybillNumber || null,
          accountNumber: c.accountNumber === '{invoice_number}' ? invoiceNumber : (c.accountNumber || invoiceNumber),
          name: c.name || null,
        },
      };

    case 'bank':
      return {
        code: 'bank',
        mode: 'manual',
        title: 'Bank Transfer',
        description: 'Transfer to our bank account.',
        steps: [
          `Bank: ${c.bankName || '[not configured]'}`,
          `Account name: ${c.accountName || '[not configured]'}`,
          `Account number: ${c.accountNumber || '[not configured]'}`,
          c.branch ? `Branch: ${c.branch}` : null,
          c.swift ? `SWIFT: ${c.swift}` : null,
          `Amount: ${currency} ${amount}`,
          `Reference: ${invoiceNumber}`,
          'Send us a screenshot or the bank reference once paid',
        ].filter(Boolean),
        recipient: {
          bankName: c.bankName || null,
          accountName: c.accountName || null,
          accountNumber: c.accountNumber || null,
          branch: c.branch || null,
          swift: c.swift || null,
        },
      };

    case 'stripe':
      return {
        code: 'stripe',
        mode: 'auto',
        title: 'Card (Stripe)',
        description: 'Pay securely by card.',
        action: {
          type: 'stripe',
          label: 'Pay with card',
          amount,
          currency,
          invoiceNumber,
        },
      };

    default:
      return null;
  }
}

async function getPaymentInstructions({ amount, currency, invoiceNumber }) {
  const methods = await PaymentMethod.find({ enabled: true }).sort({ order: 1 }).lean();

  const instructions = [];
  for (const m of methods) {
    const clean = { ...m, config: sanitizeConfig(m.code, m.config) };
    const built = buildInstructions(clean, { amount, currency, invoiceNumber });
    if (built) instructions.push(built);
  }

  return instructions;
}

async function getPublicPaymentMethods() {
  const methods = await PaymentMethod.find({ enabled: true }).sort({ order: 1 }).lean();

  return methods.map((m) => ({
    code: m.code,
    label: m.label,
    mode: m.mode,
    config: sanitizeConfig(m.code, m.config),
  }));
}

module.exports = { getPaymentInstructions, getPublicPaymentMethods };