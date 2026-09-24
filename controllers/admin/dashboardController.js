const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const Tenant = require('../../models/admin/Tenant');
const User = require('../../models/client/User');
const Sale = require('../../models/client/Sale');
const PendingActivation = require('../../models/admin/PendingActivation');
const AiUsageLog = require('../../models/admin/AiUsageLog');

const overview = asyncHandler(async (_req, res) => {
  const [tenants, users, sales, pending, ai] = await Promise.all([
    Tenant.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments({ status: 'active' }),
    Sale.countDocuments({ voided: { $ne: true } }),
    PendingActivation.countDocuments({ status: { $in: ['pending', 'in_review'] } }),
    AiUsageLog.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }),
  ]);

  const counts = Object.fromEntries(tenants.map((t) => [t._id, t.count]));

  return ok(res, {
    tenants: {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      active: counts.active || 0,
      pending: counts.pending_user || 0,
      suspended: counts.suspended || 0,
      rejected: counts.rejected || 0,
      expired: counts.expired || 0,
    },
    users,
    sales,
    pendingQueue: pending,
    aiCalls30d: ai,
  });
});

const recent = asyncHandler(async (_req, res) => {
  const [tenants, pending] = await Promise.all([
    Tenant.find().sort({ registeredAt: -1 }).limit(10).lean(),
    PendingActivation.find({ status: { $in: ['pending', 'in_review'] } })
      .sort({ registeredAt: -1 })
      .limit(10)
      .lean(),
  ]);

  return ok(res, { tenants, pending });
});

const charts = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [signups, approvals] = await Promise.all([
    Tenant.aggregate([
      { $match: { registeredAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Tenant.aggregate([
      { $match: { approvedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$approvedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return ok(res, { signups, approvals });
});

module.exports = { overview, recent, charts };