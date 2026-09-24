const { Router } = require('express');
const c = require('../../controllers/client/settingsController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

router.use(requireActive);
router.use(roles('owner'));

router.get('/', c.get);
router.patch('/', c.update);
router.post('/payments/:code/enable', c.enablePayment);
router.delete('/payments/:code', c.disablePayment);

module.exports = router;