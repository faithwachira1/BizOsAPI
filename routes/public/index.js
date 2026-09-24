const { Router } = require('express');

const authRoutes = require('./authRoutes');
const siteRoutes = require('./siteRoutes');
const legalRoutes = require('./legalRoutes');
const chatRoutes = require('./chatRoutes');
const webhookRoutes = require('./webhookRoutes');
const paymentRoutes = require('./paymentRoutes');
const invoiceRoutes = require('./invoiceRoutes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/site', siteRoutes);
router.use('/legal', legalRoutes);
router.use('/chat', chatRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/payments', paymentRoutes);
router.use('/invoices', invoiceRoutes);

module.exports = router;