const cors = require('cors');
const { env } = require('../../config/env');

const corsMw = cors({
  origin: (origin, cb) => {
    if (!origin || env.cors.origins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
});

module.exports = { corsMw };