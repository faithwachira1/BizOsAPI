const axios = require('axios');
const { mpesa } = require('../config/mpesa');
const cacheService = require('./cacheService');
const { ApiError } = require('../utils/apiError');
const { logger } = require('../utils/logger');

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

async function getAccessToken() {
  const cacheKey = 'mpesa:token';
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  const auth = Buffer.from(`${mpesa.consumerKey}:${mpesa.consumerSecret}`).toString('base64');

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
  const token = await getAccessToken();
  const ts = timestamp();
  const pwd = password(mpesa.shortcode, mpesa.passkey, ts);

  try {
    const res = await axios.post(
      `${mpesa.baseUrl}${mpesa.endpoints.STK_PUSH}`,
      {
        BusinessShortCode: mpesa.shortcode,
        Password: pwd,
        Timestamp: ts,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: phone,
        PartyB: mpesa.shortcode,
        PhoneNumber: phone,
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
    logger.error({ err: err.message }, 'mpesa stk push failed');
    throw ApiError.badRequest('MPESA_STK_FAILED', 'Could not initiate M-Pesa payment');
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
    return { success: true, raw: res.data };
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
    resultCode,
    resultDesc: stk.ResultDesc,
    checkoutRequestId: stk.CheckoutRequestID,
    merchantRequestId: stk.MerchantRequestID,
    amount: pick('Amount'),
    mpesaReceiptNumber: pick('MpesaReceiptNumber'),
    transactionDate: pick('TransactionDate'),
    phone: pick('PhoneNumber'),
  };
}

module.exports = {
  stkPush,
  queryStkStatus,
  parseCallback,
};