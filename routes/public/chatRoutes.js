const { Router } = require('express');
const c = require('../../controllers/public/chatController');

const router = Router();

router.post('/message', c.message);

module.exports = router;