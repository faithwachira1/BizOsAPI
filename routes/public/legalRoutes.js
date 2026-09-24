const { Router } = require('express');
const c = require('../../controllers/public/legalController');

const router = Router();

router.get('/:type', c.getCurrent);

module.exports = router;