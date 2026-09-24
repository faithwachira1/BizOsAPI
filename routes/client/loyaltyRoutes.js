const { Router } = require('express');
const c = require('../../controllers/client/loyaltyController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);

// Any active user can view loyalty config + balances + history
router.get('/config', c.getConfig);
router.get('/customers/:customerId', c.getBalance);
router.get('/customers/:customerId/history', c.getHistory);

// Only owner/manager can mutate points
router.post('/customers/:customerId/adjust', roles('owner', 'manager'), c.adjust);
router.post('/customers/:customerId/redeem', roles('owner', 'manager'), c.redeem);

module.exports = router;