const { Router } = require('express');
const c = require('../../controllers/client/chatController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);
router.use(roles('owner', 'manager'));

router.post('/message', c.message);
router.get('/history', c.history);
router.delete('/history', c.clear);

module.exports = router;