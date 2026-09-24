const { Router } = require('express');
const c = require('../../controllers/client/paymentController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);

router.get('/', c.list);
router.post('/initiate', c.initiate);
router.post('/manual', c.recordManual);
router.post('/:id/refund', roles('owner', 'manager'), c.refund);

module.exports = router;