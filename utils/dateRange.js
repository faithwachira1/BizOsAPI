function resolveDateRange({ from, to, period } = {}) {
  const now = new Date();
  const endOfDay = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };
  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  if (period === 'today') return { start: startOfDay(now), end: endOfDay(now) };

  if (period === 'week') {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { start: startOfDay(s), end: endOfDay(now) };
  }

  if (period === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: startOfDay(s), end: endOfDay(now) };
  }

  return {
    start: from ? startOfDay(new Date(from)) : startOfDay(now),
    end: to ? endOfDay(new Date(to)) : endOfDay(now),
  };
}

module.exports = { resolveDateRange };