const { Router } = require('express');
const c = require('../../controllers/admin/dashboardController');

const router = Router();

router.get('/overview', c.overview);
router.get('/recent', c.recent);
router.get('/charts', c.charts);

module.exports = router;