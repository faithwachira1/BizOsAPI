const { Router } = require('express');
const c = require('../../controllers/client/customerInvoiceController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

const OBJECT_ID = '[0-9a-fA-F]{24}';

router.use(requireActive);

router.get('/', c.list);
router.get('/summary', c.summary);
router.get(`/:id(${OBJECT_ID})`, c.get);

router.post('/', roles('owner', 'manager'), c.create);
router.post(`/:id(${OBJECT_ID})/send`, roles('owner', 'manager'), c.send);
router.post(`/:id(${OBJECT_ID})/payments`, roles('owner', 'manager'), c.recordPayment);
router.post(`/:id(${OBJECT_ID})/cancel`, roles('owner', 'manager'), c.cancel);

module.exports = router;