const { Router } = require('express');
const c = require('../../controllers/admin/healthController');

const router = Router();

router.get('/', c.health);
router.get('/ready', c.ready);
router.get('/metrics', c.metrics);

module.exports = router;