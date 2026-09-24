const { Router } = require('express');
const c = require('../../controllers/client/profileController');
const { uploadSingle } = require('../../middleware/global/upload');

const router = Router();

router.get('/', c.get);
router.patch('/', c.update);
router.post('/logo', uploadSingle, c.uploadLogo);

module.exports = router;