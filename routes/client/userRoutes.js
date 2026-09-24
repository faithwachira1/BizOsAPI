const { Router } = require('express');
const c = require('../../controllers/client/userController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);
router.use(roles('owner'));

router.get('/', c.list);
router.post('/invite', c.invite);
router.get('/:id', c.get);
router.patch('/:id/role', c.updateRole);
router.post('/:id/deactivate', c.deactivate);
router.post('/:id/reset-password', c.resetPassword);

module.exports = router;