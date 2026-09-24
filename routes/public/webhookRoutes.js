const { Router } = require('express');
const c = require('../../controllers/public/webhookController');

const router = Router();

router.post('/mpesa/callback', c.mpesaCallback);
router.post('/mpesa/timeout', c.mpesaTimeout);
router.post('/stripe', c.stripeWebhook);
router.post('/paystack', c.paystackWebhook);
router.post('/flutterwave', c.flutterwaveWebhook);

module.exports = router;