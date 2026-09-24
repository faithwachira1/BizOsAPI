function ok(res, data, meta = null) {
  return res.status(200).json({ success: true, data, meta });
}

function created(res, data) {
  return res.status(201).json({ success: true, data });
}

function noContent(res) {
  return res.status(204).end();
}

function paginated(res, items, page, limit, total) {
  return res.status(200).json({
    success: true,
    data: items,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

module.exports = { ok, created, noContent, paginated };