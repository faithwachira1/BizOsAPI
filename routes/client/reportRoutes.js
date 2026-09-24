const { Router } = require('express');
const c = require('../../controllers/client/reportController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);
router.use(roles('owner', 'manager'));

router.get('/sales', c.salesSummary);
router.get('/top-products', c.topProducts);
router.get('/staff', c.staff);
router.get('/export', c.exportData);

module.exports = router;