const { Router } = require('express');
const c = require('../../controllers/client/invoiceController');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

const OBJECT_ID = '[0-9a-fA-F]{24}';

router.use(requireActive);

router.get('/', c.list);
router.get('/summary', c.summary);
router.get(`/:id(${OBJECT_ID})`, c.get);

module.exports = router;