const { Router } = require('express');
const c = require('../../controllers/admin/aiUsageController');

const router = Router();

router.get('/', c.list);
router.get('/summary', c.summary);

module.exports = router;