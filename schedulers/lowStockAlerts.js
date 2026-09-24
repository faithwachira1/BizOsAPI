const Tenant = require('../models/admin/Tenant');
const Product = require('../models/client/Product');
const User = require('../models/client/User');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const { getRedis } = require('../config/redis');
const { env } = require('../config/env');
const { logger } = require('../utils/logger');

async function wasAlertedToday(tenantId, productId) {
  const redis = getRedis();
  if (!redis) return false;
  const key = `alert:lowstock:${tenantId}:${productId}:${new Date().toISOString().slice(0, 10)}`;
  const exists = await redis.exists(key);
  if (exists) return true;
  await redis.set(key, '1', 'EX', 86400);
  return false;
}

async function runLowStockAlerts() {
  const tenants = await Tenant.find({ status: 'active' }).select('_id name').lean();

  for (const tenant of tenants) {
    try {
      const owners = await User.find({
        tenantId: tenant._id,
        role: 'owner',
        status: 'active',
      })
        .select('email phone fullName')
        .lean();

      if (!owners.length) continue;

      const low = await Product.find({
        tenantId: tenant._id,
        active: true,
        $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      })
        .select('name stock lowStockThreshold')
        .lean();

      for (const product of low) {
        const already = await wasAlertedToday(tenant._id, product._id);
        if (already) continue;

        for (const owner of owners) {
          if (owner.email) {
            emailService
              .sendLowStockEmail(owner.email, {
                businessName: tenant.name,
                productName: product.name,
                qty: product.stock,
                threshold: product.lowStockThreshold,
                productUrl: `${env.appUrl}/app/products`,
              })
              .catch((e) => logger.error({ err: e.message }, 'lowStock email failed'));
          }

          if (owner.phone) {
            smsService
              .sendLowStockAlert(owner.phone, {
                productName: product.name,
                qty: product.stock,
              })
              .catch((e) => logger.error({ err: e.message }, 'lowStock sms failed'));
          }
        }
      }
    } catch (err) {
      logger.error({ tenantId: tenant._id, err: err.message }, 'lowStock tenant failed');
    }
  }
}

module.exports = { runLowStockAlerts };