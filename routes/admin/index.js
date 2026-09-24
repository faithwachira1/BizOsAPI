const { Router } = require('express');
const { adminAuth } = require('../../middleware/admin/adminAuth');
const { superAdminOnly } = require('../../middleware/admin/superAdminOnly');
const { adminAudit } = require('../../middleware/admin/adminAudit');

const authRoutes = require('./authRoutes');
const healthRoutes = require('./healthRoutes');
const legalRoutes = require('./legalRoutes');
const tenantRoutes = require('./tenantRoutes');
const pendingRoutes = require('./pendingRoutes');
const planRoutes = require('./planRoutes');
const paymentMethodRoutes = require('./paymentMethodRoutes');
const settingsRoutes = require('./settingsRoutes');
const backupRoutes = require('./backupRoutes');
const aiUsageRoutes = require('./aiUsageRoutes');
const auditRoutes = require('./auditRoutes');
const dashboardRoutes = require('./dashboardRoutes');

const router = Router();

router.use('/auth', authRoutes);

router.use(adminAuth, superAdminOnly, adminAudit);

router.use('/health', healthRoutes);
router.use('/legal', legalRoutes);
router.use('/tenants', tenantRoutes);
router.use('/pending', pendingRoutes);
router.use('/plans', planRoutes);
router.use('/payment-methods', paymentMethodRoutes);
router.use('/settings', settingsRoutes);
router.use('/backups', backupRoutes);
router.use('/ai-usage', aiUsageRoutes);
router.use('/audit', auditRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;