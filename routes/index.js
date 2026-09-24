const { Router } = require('express');

const publicRoutes = require('./public');
const adminRoutes = require('./admin');
const clientRoutes = require('./client');

const router = Router();

router.use('/public', publicRoutes);
router.use('/admin', adminRoutes);
router.use('/client', clientRoutes);

module.exports = router;