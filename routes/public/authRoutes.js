const { Router } = require('express');
const c = require('../../controllers/public/authController');

const router = Router();

router.post('/register', c.register);
router.post('/login', c.login);
router.post('/refresh', c.refresh);
router.post('/verify', c.verifyEmail);
router.post('/forgot-password', c.forgotPassword);
router.post('/reset-password', c.resetPassword);
router.post('/accept-invite', c.acceptInvite);

module.exports = router;