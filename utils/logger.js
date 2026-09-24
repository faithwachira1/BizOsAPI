const pino = require('pino');
const { env } = require('../config/env');

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'otp',
  'apiKey',
  'secret',
];

const logger = pino({
  level: env.isProd ? 'info' : 'debug',
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: env.isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service',
          messageFormat: '{msg}',
          singleLine: false,
          levelFirst: false,
          customColors: 'info:blue,warn:yellow,error:red,debug:gray',
          customLevels: 'trace:10,debug:20,info:30,warn:40,error:50,fatal:60',
          useOnlyCustomProps: false,
        },
      },
});

function childLogger(req) {
  return logger.child({
    requestId: req.id,
    tenantId: req.user?.tenantId,
    userId: req.user?.id,
    role: req.user?.role,
    ip: req.ip,
    method: req.method,
    path: req.path,
  });
}

module.exports = { logger, childLogger };