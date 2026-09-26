const cors = require('cors');
const { env } = require('../../config/env');

const allowedOrigins = new Set([
  ...env.cors.origins,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const corsMw = cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
});

module.exports = { corsMw };