const { Router } = require('express');
const c = require('../../controllers/client/invitationController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);
router.use(roles('owner'));

router.get('/', c.list);
router.post('/:id/resend', c.resend);
router.delete('/:id', c.cancel);

module.exports = router;