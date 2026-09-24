const { Router } = require('express');
const c = require('../../controllers/admin/legalController');

const router = Router();

router.get('/', c.list);
router.get('/:type', c.getByType);
router.get('/:type/current', c.getCurrent);
router.get('/:type/:version', c.getByVersion);
router.post('/:type/publish', c.publish);
router.patch('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;