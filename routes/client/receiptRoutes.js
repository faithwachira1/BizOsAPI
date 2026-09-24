const { Router } = require('express');
const c = require('../../controllers/client/receiptController');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);

router.get('/:saleId', c.get);
router.get('/:saleId/pdf', c.pdf);
router.post('/:saleId/email', c.email);

module.exports = router;