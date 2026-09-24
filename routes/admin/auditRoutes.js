const { Router } = require('express');
const c = require('../../controllers/admin/auditController');

const router = Router();

router.get('/', c.list);
router.get('/tenant/:tenantId', c.byTenant);

module.exports = router;