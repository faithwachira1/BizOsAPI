const { getRedis } = require('../config/redis');
const { logger } = require('../utils/logger');

function client() {
  return getRedis();
}

async function get(key) {
  const r = client();
  if (!r) return null;
  try {
    return await r.get(key);
  } catch (err) {
    logger.error({ err: err.message, key }, 'cache get failed');
    return null;
  }
}

async function set(key, value, ttlSec = 3600) {
  const r = client();
  if (!r) return false;
  try {
    await r.set(key, value, 'EX', ttlSec);
    return true;
  } catch (err) {
    logger.error({ err: err.message, key }, 'cache set failed');
    return false;
  }
}

async function del(key) {
  const r = client();
  if (!r) return false;
  try {
    await r.del(key);
    return true;
  } catch (err) {
    logger.error({ err: err.message, key }, 'cache del failed');
    return false;
  }
}

async function getJson(key) {
  const raw = await get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setJson(key, obj, ttlSec = 3600) {
  return set(key, JSON.stringify(obj), ttlSec);
}

function tenantKey(tenantId, ...parts) {
  return `tenant:${tenantId}:${parts.filter(Boolean).join(':')}`;
}

async function remember(tenantId, key, ttlSec, loader) {
  const full = tenantId ? tenantKey(tenantId, key) : key;
  const cached = await getJson(full);
  if (cached) return cached;

  const fresh = await loader();
  if (fresh !== undefined && fresh !== null) {
    await setJson(full, fresh, ttlSec);
  }
  return fresh;
}

async function invalidateTenant(tenantId) {
  const r = client();
  if (!r) return;
  try {
    const pattern = `tenant:${tenantId}:*`;
    const stream = r.scanStream({ match: pattern, count: 100 });
    const keys = [];
    for await (const chunk of stream) keys.push(...chunk);
    if (keys.length) await r.del(keys);
  } catch (err) {
    logger.error({ err: err.message, tenantId }, 'cache invalidate failed');
  }
}

module.exports = {
  get,
  set,
  del,
  getJson,
  setJson,
  tenantKey,
  remember,
  invalidateTenant,
};