const cron = require('node-cron');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');
const { getRedis } = require('../config/redis');

const { runDailyMetrics } = require('./dailyMetrics');
const { runAiInsights } = require('./aiInsights');
const { runLowStockAlerts } = require('./lowStockAlerts');
const { runPendingExpiry } = require('./pendingExpiry');
const { runAutoBackup } = require('./autoBackup');
const { runOverdueInvoices } = require('./overdueInvoices');

const jobs = [
  { name: 'dailyMetrics', cron: '5 0 * * *', fn: runDailyMetrics },
  { name: 'aiInsights', cron: '0 1 * * *', fn: runAiInsights },
  { name: 'overdueInvoices', cron: '0 2 * * *', fn: runOverdueInvoices },
  { name: 'pendingExpiry', cron: '0 2 * * *', fn: runPendingExpiry },
  { name: 'autoBackup', cron: '0 3 * * *', fn: runAutoBackup },
  { name: 'lowStockAlerts', cron: '0 7 * * *', fn: runLowStockAlerts },
];

const started = new Set();

async function acquireLock(name, ttlSec) {
  const redis = getRedis();
  if (!redis) return true;
  const key = `job:lock:${name}`;
  const result = await redis.set(key, '1', 'EX', ttlSec, 'NX');
  return result === 'OK';
}

async function releaseLock(name) {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(`job:lock:${name}`);
}

function startSchedulers() {
  if (env.disableSchedulers) {
    logger.warn('schedulers disabled via DISABLE_SCHEDULERS');
    return;
  }

  for (const job of jobs) {
    if (started.has(job.name)) continue;
    started.add(job.name);

    cron.schedule(job.cron, async () => {
      const t0 = Date.now();
      const log = logger.child({ job: job.name });

      const gotLock = await acquireLock(job.name, 3600);
      if (!gotLock) {
        log.warn('skipped, already running');
        return;
      }

      log.info('start');
      try {
        await job.fn();
        log.info({ ms: Date.now() - t0 }, 'done');
      } catch (err) {
        log.error({ err: err.message, stack: err.stack }, 'failed');
      } finally {
        await releaseLock(job.name);
      }
    });

    logger.info({ job: job.name, cron: job.cron }, 'scheduler registered');
  }

  logger.info({ count: jobs.length }, 'schedulers started');
}

module.exports = { startSchedulers };