const { Router } = require('express');
const c = require('../../controllers/client/saleController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);

router.get('/', c.list);
router.get('/:id', c.get);
router.post('/', c.create);
router.post('/:id/void', roles('owner', 'manager'), c.voidSale);
router.post('/:id/reprint', c.reprint);

module.exports = router;