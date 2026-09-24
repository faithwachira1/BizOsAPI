const { Router } = require('express');
const c = require('../../controllers/admin/tenantController');

const router = Router();

router.get('/', c.list);
router.get('/:id', c.get);
router.patch('/:id', c.update);
router.post('/:id/suspend', c.suspend);
router.post('/:id/reactivate', c.reactivate);
router.delete('/:id', c.remove);
router.post('/:id/impersonate', c.impersonate);

module.exports = router;