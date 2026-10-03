const { env } = require('./env');

const mpesa = Object.freeze({
  baseUrl: env.mpesa.baseUrl,
  env: env.mpesa.env,
  consumerKey: env.mpesa.consumerKey,
  consumerSecret: env.mpesa.consumerSecret,
  shortcode: env.mpesa.shortcode,
  tillNumber: env.mpesa.tillNumber,
  passkey: env.mpesa.passkey,
  callbackUrl: env.mpesa.callbackUrl,
  transactionType: env.mpesa.transactionType,
  enabled: env.mpesa.enabled,
  endpoints: Object.freeze({
    OAUTH: '/oauth/v1/generate?grant_type=client_credentials',
    STK_PUSH: '/mpesa/stkpush/v1/processrequest',
    STK_QUERY: '/mpesa/stkpushquery/v1/query',
  }),
});

module.exports = { mpesa };