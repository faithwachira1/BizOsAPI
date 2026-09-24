require('dotenv/config');
const express = require('express');

const pkg = require('./package.json');
const { env } = require('./config/env');
const { connectDB, disconnectDB, mongoose } = require('./config/db');
const { connectRedis, disconnectRedis, getRedis } = require('./config/redis');
const { logger } = require('./utils/logger');

const { requestId } = require('./middleware/global/requestId');
const { requestLogger } = require('./middleware/global/requestLogger');
const { helmetMw } = require('./middleware/global/helmet');
const { corsMw } = require('./middleware/global/cors');
const { bodyParser } = require('./middleware/global/bodyParser');
const { rateLimitMw } = require('./middleware/global/rateLimit');
const { sanitize } = require('./middleware/global/sanitize');
const { notFound } = require('./middleware/global/notFound');
const { errorHandler } = require('./middleware/global/errorHandler');

const routes = require('./routes');
const { startSchedulers } = require('./schedulers');

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function stripAnsi(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, '');
}

function banner(lines) {
  const width = Math.max(...lines.map((l) => stripAnsi(l).length)) + 4;
  const top = `╭${'─'.repeat(width)}╮`;
  const bottom = `╰${'─'.repeat(width)}╯`;
  const body = lines
    .map((l) => `│  ${l}${' '.repeat(width - stripAnsi(l).length - 2)}│`)
    .join('\n');
  return `\n${top}\n${body}\n${bottom}\n`;
}

async function bootstrap() {
  process.stdout.write(
    banner([
      `${C.bold}${C.cyan}BizOS API${C.reset}`,
      `${C.dim}version:${C.reset} ${pkg.version}`,
      `${C.dim}env:${C.reset}     ${env.nodeEnv}`,
      `${C.dim}port:${C.reset}    ${env.port}`,
    ])
  );

  try {
    await connectDB();
  } catch (e) {
    logger.error({ err: e.message }, 'boot failed: mongodb');
    process.exit(1);
  }

  try {
    const redis = await connectRedis();
    if (!redis) logger.warn('boot: redis disabled');
  } catch (e) {
    logger.warn({ err: e.message }, 'boot: redis failed — continuing');
  }

  const app = express();

  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(requestLogger);
  app.use(helmetMw);
  app.use(corsMw);

  app.use('/api/public/webhooks', express.raw({ type: '*/*' }));

  app.use(bodyParser);
  app.use(sanitize);
  app.use(rateLimitMw);

  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'bizos-api',
      version: pkg.version,
      message: 'BizOS API — running',
    });
  });

  app.get('/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    const redisClient = getRedis();
    const redisUp = redisClient ? redisClient.status === 'ready' : false;

    res.json({
      ok: true,
      status: dbUp ? 'healthy' : 'degraded',
      version: pkg.version,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb: dbUp ? 'up' : 'down',
        redis: redisUp ? 'up' : env.redis.enabled ? 'down' : 'disabled',
      },
    });
  });

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  const server = app.listen(env.port, () => {
    const url = `http://localhost:${env.port}`;
    logger.info(
      `\n${C.green}${C.bold}✔ Ready${C.reset}\n` +
        `   ${C.dim}version:${C.reset}  ${pkg.version}\n` +
        `   ${C.dim}local:${C.reset}    ${C.cyan}${url}${C.reset}\n` +
        `   ${C.dim}health:${C.reset}   ${C.cyan}${url}/health${C.reset}\n` +
        `   ${C.dim}api:${C.reset}      ${C.cyan}${url}/api${C.reset}\n` +
        `   ${C.dim}public:${C.reset}   ${C.cyan}${url}/api/public${C.reset}\n` +
        `   ${C.dim}admin:${C.reset}    ${C.cyan}${url}/api/admin${C.reset}\n` +
        `   ${C.dim}client:${C.reset}   ${C.cyan}${url}/api/client${C.reset}\n`
    );
  });

  if (!env.disableSchedulers) {
    try {
      startSchedulers();
    } catch (e) {
      logger.error({ err: e.message }, 'schedulers failed to start');
    }
  }

  const shutdown = async (signal) => {
    logger.warn(`shutdown: ${signal}`);
    server.close(async () => {
      try {
        await disconnectRedis();
        await disconnectDB();
        logger.info('shutdown complete');
        process.exit(0);
      } catch (e) {
        logger.error({ err: e.message }, 'shutdown error');
        process.exit(1);
      }
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason: String(reason) }, 'unhandledRejection');
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err: err.message, stack: err.stack }, 'uncaughtException');
    process.exit(1);
  });
}

bootstrap();