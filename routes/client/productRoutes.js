const { Router } = require('express');
const c = require('../../controllers/client/productController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');
const { uploadSingle } = require('../../middleware/global/upload');

const router = Router();

router.use(requireActive);

router.get('/', c.list);
router.get('/:id', c.get);
router.post('/', roles('owner', 'manager'), c.create);
router.patch('/:id', roles('owner', 'manager'), c.update);
router.delete('/:id', roles('owner', 'manager'), c.remove);
router.post('/upload-image', roles('owner', 'manager'), uploadSingle, c.uploadImage);

module.exports = router;