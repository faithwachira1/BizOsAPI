const { Router } = require('express');
const c = require('../../controllers/client/insightController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);
router.use(roles('owner', 'manager'));

router.get('/today', c.today);
router.get('/range', c.range);
router.post('/chat', c.chat);
router.get('/stock-alerts', c.stockAlerts);

module.exports = router;