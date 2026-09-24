const Redis = require('ioredis');
const { env } = require('./env');
const { logger } = require('../utils/logger');

let redis = null;

async function connectRedis() {
  if (!env.redis.enabled) {
    logger.warn('redis disabled via REDIS_ENABLED=false');
    return null;
  }

  redis = new Redis(env.redis.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  redis.on('connect', () => logger.info('redis connected'));
  redis.on('error', (e) => logger.error({ err: e.message }, 'redis error'));
  redis.on('close', () => logger.warn('redis connection closed'));

  await redis.connect();
  return redis;
}

function getRedis() {
  return redis;
}

async function disconnectRedis() {
  if (redis) await redis.quit();
}

module.exports = { connectRedis, disconnectRedis, getRedis };