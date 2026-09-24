const { env } = require('./env');

const MPESA_BASE_URLS = Object.freeze({
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
});

const mpesa = Object.freeze({
  baseUrl: MPESA_BASE_URLS[env.mpesa.env] || MPESA_BASE_URLS.sandbox,
  env: env.mpesa.env,
  consumerKey: env.mpesa.consumerKey,
  consumerSecret: env.mpesa.consumerSecret,
  shortcode: env.mpesa.shortcode,
  passkey: env.mpesa.passkey,
  callbackUrl: env.mpesa.callbackUrl,
  endpoints: Object.freeze({
    OAUTH: '/oauth/v1/generate?grant_type=client_credentials',
    STK_PUSH: '/mpesa/stkpush/v1/processrequest',
    STK_QUERY: '/mpesa/stkpushquery/v1/query',
  }),
});

module.exports = { mpesa };