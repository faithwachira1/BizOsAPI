const axios = require('axios');
const { mpesa } = require('../config/mpesa');
const cacheService = require('./cacheService');
const { ApiError } = require('../utils/apiError');
const { logger } = require('../utils/logger');

const RESULT_CODES = {
  SUCCESS: '0',
  INSUFFICIENT_FUNDS: '1',
  LESS_THAN_MINIMUM: '1001',
  EXCEED_MAX_AMOUNT: '1002',
  EXCEED_DAILY_LIMIT: '1003',
  EXCEED_MIN_BALANCE: '1004',
  INVALID_ACCOUNT: '1006',
  USER_UNREACHABLE: '1019',
  USER_CANCELLED: '1032',
  DS_TIMEOUT: '1037',
  WRONG_PIN: '2001',
  AGENT_STORE_MISMATCH: '2002',
  TRANSACTION_NOT_FOUND: '500.001.1001',
  MERCHANT_NOT_EXIST: '4999',
  UNRESOLVED_REASON: '2029',
};

const seenCallbacks = new Map();
const CALLBACK_TTL_MS = 24 * 60 * 60 * 1000;

function pruneSeenCallbacks() {
  const now = Date.now();
  for (const [key, ts] of seenCallbacks.entries()) {
    if (now - ts > CALLBACK_TTL_MS) seenCallbacks.delete(key);
  }
}

function isDuplicateCallback(checkoutRequestId) {
  if (!checkoutRequestId) return false;
  pruneSeenCallbacks();
  if (seenCallbacks.has(checkoutRequestId)) return true;
  seenCallbacks.set(checkoutRequestId, Date.now());
  return false;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function password(shortcode, passkey, ts) {
  return Buffer.from(`${shortcode}${passkey}${ts}`).toString('base64');
}

function normalizePhone(phone) {
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  else if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
  return p;
}

async function getAccessToken() {
  const cacheKey = 'mpesa:token';
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  const auth = Buffer.from(
    `${mpesa.consumerKey}:${mpesa.consumerSecret}`
  ).toString('base64');

  try {
    const res = await axios.get(`${mpesa.baseUrl}${mpesa.endpoints.OAUTH}`, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 15000,
    });
    const token = res.data.access_token;
    await cacheService.set(cacheKey, token, 3000);
    return token;
  } catch (err) {
    logger.error({ err: err.message }, 'mpesa token failed');
    throw ApiError.internal('MPESA_AUTH', 'M-Pesa authentication failed');
  }
}

async function stkPush({ phone, amount, accountRef, description }) {
  if (!mpesa.enabled) {
    throw ApiError.internal(
      'MPESA_NOT_CONFIGURED',
      'M-Pesa is not configured'
    );
  }

  const token = await getAccessToken();
  const ts = timestamp();
  const pwd = password(mpesa.shortcode, mpesa.passkey, ts);
  const normalized = normalizePhone(phone);
  const partyB = mpesa.tillNumber || mpesa.shortcode;

  try {
    const res = await axios.post(
      `${mpesa.baseUrl}${mpesa.endpoints.STK_PUSH}`,
      {
        BusinessShortCode: mpesa.shortcode,
        Password: pwd,
        Timestamp: ts,
        TransactionType: mpesa.transactionType,
        Amount: Math.round(amount),
        PartyA: normalized,
        PartyB: partyB,
        PhoneNumber: normalized,
        CallBackURL: mpesa.callbackUrl,
        AccountReference: accountRef,
        TransactionDesc: description,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
      }
    );

    return {
      success: true,
      checkoutRequestId: res.data.CheckoutRequestID,
      merchantRequestId: res.data.MerchantRequestID,
      customerMessage: res.data.CustomerMessage,
      raw: res.data,
    };
  } catch (err) {
    logger.error(
      {
        err: err.message,
        status: err.response?.status,
        data: err.response?.data,
      },
      'mpesa stk push failed'
    );
    throw ApiError.badRequest(
      'MPESA_STK_FAILED',
      err.response?.data?.errorMessage || 'Could not initiate M-Pesa payment'
    );
  }
}

async function queryStkStatus(checkoutRequestId) {
  const token = await getAccessToken();
  const ts = timestamp();
  const pwd = password(mpesa.shortcode, mpesa.passkey, ts);

  try {
    const res = await axios.post(
      `${mpesa.baseUrl}${mpesa.endpoints.STK_QUERY}`,
      {
        BusinessShortCode: mpesa.shortcode,
        Password: pwd,
        Timestamp: ts,
        CheckoutRequestID: checkoutRequestId,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      }
    );
    return {
      success: true,
      resultCode: String(res.data.ResultCode),
      resultDesc: res.data.ResultDesc,
      raw: res.data,
    };
  } catch (err) {
    logger.error({ err: err.message }, 'mpesa query failed');
    return { success: false, error: err.message };
  }
}

function parseCallback(payload) {
  const stk = payload?.Body?.stkCallback;
  if (!stk) return { success: false, error: 'Invalid callback shape' };

  const resultCode = stk.ResultCode;
  const items = stk.CallbackMetadata?.Item || [];
  const pick = (name) => items.find((i) => i.Name === name)?.Value;

  return {
    success: resultCode === 0,
    resultCode: String(resultCode),
    resultDesc: stk.ResultDesc,
    checkoutRequestId: stk.CheckoutRequestID,
    merchantRequestId: stk.MerchantRequestID,
    amount: pick('Amount'),
    mpesaReceiptNumber: pick('MpesaReceiptNumber'),
    transactionDate: pick('TransactionDate'),
    phone: pick('PhoneNumber'),
  };
}

async function waitForResult(
  checkoutRequestId,
  { timeoutMs = 300000, intervalMs = 3000 } = {}
) {
  const start = Date.now();
  const pendingCodes = new Set([
    RESULT_CODES.TRANSACTION_NOT_FOUND,
    '500.001.1001',
    '4999',
  ]);

  while (Date.now() - start < timeoutMs) {
    const r = await queryStkStatus(checkoutRequestId);
    if (r.success && !pendingCodes.has(r.resultCode)) {
      return r;
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }

  return {
    success: false,
    error: { errorMessage: 'timeout', code: 'TIMEOUT' },
  };
}

module.exports = {
  stkPush,
  queryStkStatus,
  parseCallback,
  normalizePhone,
  isDuplicateCallback,
  waitForResult,
  RESULT_CODES,
};