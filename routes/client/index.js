const { Router } = require('express');
const { clientAuth } = require('../../middleware/client/clientAuth');
const { tenantScope } = require('../../middleware/client/tenantScope');

const authRoutes = require('./authRoutes');
const profileRoutes = require('./profileRoutes');
const productRoutes = require('./productRoutes');
const saleRoutes = require('./saleRoutes');
const paymentRoutes = require('./paymentRoutes');
const customerRoutes = require('./customerRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const userRoutes = require('./userRoutes');
const invitationRoutes = require('./invitationRoutes');
const settingsRoutes = require('./settingsRoutes');
const insightRoutes = require('./insightRoutes');
const reportRoutes = require('./reportRoutes');
const receiptRoutes = require('./receiptRoutes');
const chatRoutes = require('./chatRoutes');
const supplierRoutes = require('./supplierRoutes');
const loyaltyRoutes = require('./loyaltyRoutes');
const heldSaleRoutes = require('./heldSaleRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const customerInvoiceRoutes = require('./customerInvoiceRoutes');
const purchaseOrderRoutes = require('./purchaseOrderRoutes');
const notificationRoutes = require('./notificationRoutes');

const router = Router();

router.use(clientAuth, tenantScope);

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/products', productRoutes);
router.use('/sales', saleRoutes);
router.use('/payments', paymentRoutes);
router.use('/customers', customerRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/users', userRoutes);
router.use('/invitations', invitationRoutes);
router.use('/settings', settingsRoutes);
router.use('/insights', insightRoutes);
router.use('/reports', reportRoutes);
router.use('/receipts', receiptRoutes);
router.use('/chat', chatRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/loyalty', loyaltyRoutes);
router.use('/held-sales', heldSaleRoutes);
router.use('/invoices/customer', customerInvoiceRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;