const { ApiError } = require('../utils/apiError');

const ALLOWED_KEYS = [
  // business
  'phone',
  'address',
  'taxPin',
  'website',
  // finance
  'currency',
  'taxRate',
  'taxInclusive',
  // receipt
  'receiptTemplate',
  'receiptFooter',
  'receiptShowLogo',
  'receiptShowTax',
  'receiptShowCustomer',
  'receiptShowCashier',
  'receiptPaperSize',
  'receiptCopies',
  // loyalty
  'loyaltyEnabled',
  'loyaltyPointsPerCurrency',
  'loyaltyCurrencyUnit',
  'loyaltyRedeemRate',
  'loyaltyMinRedeem',
  // appearance
  'compactMode',
  'sounds',
];

const ENUMS = {
  receiptTemplate: ['modern', 'detailed', 'minimal'],
  receiptPaperSize: ['58mm', '80mm', 'A4', 'A5'],
  currency: ['KES', 'USD', 'EUR', 'GBP', 'TZS', 'UGX'],
};

const NUMERIC = [
  'taxRate',
  'receiptCopies',
  'loyaltyPointsPerCurrency',
  'loyaltyCurrencyUnit',
  'loyaltyRedeemRate',
  'loyaltyMinRedeem',
];

const BOOLEAN = [
  'taxInclusive',
  'receiptShowLogo',
  'receiptShowTax',
  'receiptShowCustomer',
  'receiptShowCashier',
  'loyaltyEnabled',
  'compactMode',
  'sounds',
];

const STRING = ['phone', 'address', 'taxPin', 'website', 'receiptFooter'];

function validatePatch(input) {
  if (!input || typeof input !== 'object') {
    throw ApiError.badRequest('INVALID_BODY', 'Body must be an object');
  }

  const patch = {};
  const unknown = [];

  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_KEYS.includes(key)) {
      unknown.push(key);
      continue;
    }

    if (value === null || value === undefined) {
      patch[key] = null;
      continue;
    }

    if (ENUMS[key] && !ENUMS[key].includes(value)) {
      throw ApiError.badRequest(
        'INVALID_VALUE',
        `${key} must be one of: ${ENUMS[key].join(', ')}`
      );
    }

    if (NUMERIC.includes(key)) {
      const n = Number(value);
      if (!Number.isFinite(n)) {
        throw ApiError.badRequest('INVALID_VALUE', `${key} must be a number`);
      }
      patch[key] = n;
      continue;
    }

    if (BOOLEAN.includes(key)) {
      patch[key] = Boolean(value);
      continue;
    }

    if (STRING.includes(key)) {
      patch[key] = String(value);
      continue;
    }

    patch[key] = value;
  }

  return { patch, unknown };
}

module.exports = { ALLOWED_KEYS, validatePatch };