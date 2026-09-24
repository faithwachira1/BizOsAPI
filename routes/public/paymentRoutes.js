const { Router } = require('express');
const c = require('../../controllers/public/paymentController');

const router = Router();

router.get('/methods', c.getMethods);
router.post('/stk/invoice', c.sendStkForInvoice);

module.exports = router;