const TENANT_TZ = 'Africa/Nairobi';
const TENANT_OFFSET_MS = 3 * 60 * 60 * 1000;

function startOfDayTZ(date) {
  const utcMs = date.getTime();
  const shifted = new Date(utcMs + TENANT_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - TENANT_OFFSET_MS);
}

function endOfDayTZ(date) {
  const utcMs = date.getTime();
  const shifted = new Date(utcMs + TENANT_OFFSET_MS);
  shifted.setUTCHours(23, 59, 59, 999);
  return new Date(shifted.getTime() - TENANT_OFFSET_MS);
}

function resolveDateRange({ from, to, period } = {}) {
  const now = new Date();

  if (period === 'today') {
    return { start: startOfDayTZ(now), end: endOfDayTZ(now) };
  }

  if (period === 'week') {
    const shifted = new Date(now.getTime() + TENANT_OFFSET_MS);
    shifted.setUTCDate(shifted.getUTCDate() - 6);
    const sixDaysAgo = new Date(shifted.getTime() - TENANT_OFFSET_MS);
    return { start: startOfDayTZ(sixDaysAgo), end: endOfDayTZ(now) };
  }

  if (period === 'month') {
    const shifted = new Date(now.getTime() + TENANT_OFFSET_MS);
    const monthStart = new Date(Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      1
    ));
    const monthStartLocal = new Date(monthStart.getTime() - TENANT_OFFSET_MS);
    return { start: startOfDayTZ(monthStartLocal), end: endOfDayTZ(now) };
  }

  if (period === 'quarter') {
    const shifted = new Date(now.getTime() + TENANT_OFFSET_MS);
    const q = Math.floor(shifted.getUTCMonth() / 3);
    const qStart = new Date(Date.UTC(
      shifted.getUTCFullYear(),
      q * 3,
      1
    ));
    const qStartLocal = new Date(qStart.getTime() - TENANT_OFFSET_MS);
    return { start: startOfDayTZ(qStartLocal), end: endOfDayTZ(now) };
  }

  if (from || to) {
    const start = from ? startOfDayTZ(new Date(from)) : startOfDayTZ(now);
    const end = to ? endOfDayTZ(new Date(to)) : endOfDayTZ(now);
    return { start, end };
  }

  return { start: startOfDayTZ(now), end: endOfDayTZ(now) };
}

module.exports = { resolveDateRange };