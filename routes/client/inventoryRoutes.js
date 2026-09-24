const { Router } = require('express');
const c = require('../../controllers/client/inventoryController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);

router.get('/', c.list);
router.post('/adjust', roles('owner', 'manager'), c.adjust);
router.get('/:productId/history', c.history);

module.exports = router;