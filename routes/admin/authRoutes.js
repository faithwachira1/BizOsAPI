const { Router } = require('express');
const { adminAuth } = require('../../middleware/admin/adminAuth');
const c = require('../../controllers/admin/authController');

const router = Router();

router.post('/login', c.login);
router.post('/refresh', c.refresh);

router.post('/logout', adminAuth, c.logout);
router.get('/me', adminAuth, c.me);
router.post('/change-password', adminAuth, c.changePassword);

module.exports = router;