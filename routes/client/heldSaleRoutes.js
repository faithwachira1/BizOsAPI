const { Router } = require('express');
const c = require('../../controllers/client/heldSaleController');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);

router.get('/', c.list);
router.post('/', c.create);
router.post('/:id/resume', c.resume);
router.delete('/:id', c.remove);

module.exports = router;