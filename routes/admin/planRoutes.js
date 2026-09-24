const { Router } = require('express');
const c = require('../../controllers/admin/planController');

const router = Router();

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.get);
router.patch('/:id', c.update);
router.post('/:id/deactivate', c.deactivate);
router.delete('/:id', c.remove);

module.exports = router;