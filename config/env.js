require('dotenv/config');

const required = [
  'NODE_ENV',
  'PORT',
  'MONGODB_URI',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_TTL',
  'JWT_REFRESH_TTL',
  'HDM_API_URL',
  'HDM_API_KEY',
  'HDM_FROM_EMAIL',
  'HDM_FROM_NAME',
  'HDM_AI_URL',
  'HDM_AI_KEY',
  'CORS_ORIGINS',
  'APP_URL',
  'ADMIN_URL',
];

const optional = [
  'REDIS_ENABLED',
  'BREVO_API_KEY',
  'BREVO_SENDER_NAME',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'MPESA_ENV',
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_SHORTCODE',
  'MPESA_PASSKEY',
  'MPESA_CALLBACK_URL',
  'DISABLE_SCHEDULERS',
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

const missingOptional = optional.filter((k) => !process.env[k]);
if (missingOptional.length) {
  console.warn(`Optional env vars not set (features disabled):\n  ${missingOptional.join('\n  ')}`);
}

if (process.env.NODE_ENV === 'production') {
  const weak = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter(
    (k) => process.env[k].length < 32
  );
  if (weak.length) {
    console.error(`Weak secrets in production: ${weak.join(', ')}`);
    process.exit(1);
  }
}

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV,
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT),
  apiBaseUrl: process.env.API_BASE_URL || '',
  mongodbUri: process.env.MONGODB_URI,
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    url: process.env.REDIS_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL,
    refreshTtl: process.env.JWT_REFRESH_TTL,
  },
  mail: {
    apiUrl: process.env.HDM_API_URL,
    apiKey: process.env.HDM_API_KEY,
    fromEmail: process.env.HDM_FROM_EMAIL,
    fromName: process.env.HDM_FROM_NAME,
  },
  brevo: {
    apiKey: process.env.BREVO_API_KEY || '',
    sender: process.env.BREVO_SENDER_NAME || 'BizOS',
    enabled: Boolean(process.env.BREVO_API_KEY),
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    enabled: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    ),
  },
  hdmAi: {
    url: process.env.HDM_AI_URL,
    key: process.env.HDM_AI_KEY,
  },
  mpesa: {
    env: process.env.MPESA_ENV || 'sandbox',
    consumerKey: process.env.MPESA_CONSUMER_KEY || '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    shortcode: process.env.MPESA_SHORTCODE || '',
    passkey: process.env.MPESA_PASSKEY || '',
    callbackUrl: process.env.MPESA_CALLBACK_URL || '',
  },
  cors: {
    origins: process.env.CORS_ORIGINS
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  appUrl: process.env.APP_URL,
  adminUrl: process.env.ADMIN_URL,
  disableSchedulers: process.env.DISABLE_SCHEDULERS === 'true',
});

module.exports = { env };