const helmet = require('helmet');

const helmetMw = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

module.exports = { helmetMw };