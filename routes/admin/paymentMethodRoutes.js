const { Router } = require('express');
const c = require('../../controllers/admin/paymentMethodController');

const router = Router();

router.get('/', c.list);
router.patch('/:id', c.update);

module.exports = router;