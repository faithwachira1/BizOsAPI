const { Router } = require('express');
const c = require('../../controllers/client/authController');

const router = Router();

router.post('/logout', c.logout);
router.post('/refresh', c.refresh);
router.get('/me', c.me);
router.patch('/me', c.updateMe);
router.post('/change-password', c.changePassword);

module.exports = router;