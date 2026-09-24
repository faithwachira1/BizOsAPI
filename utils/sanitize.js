function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[\u0000-\u001F\u007F]/g, '');
}

function stripMongoOperators(obj) {
  if (Array.isArray(obj)) return obj.map(stripMongoOperators);
  if (obj && typeof obj === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      clean[k] = stripMongoOperators(v);
    }
    return clean;
  }
  return obj;
}

module.exports = { sanitizeString, stripMongoOperators };