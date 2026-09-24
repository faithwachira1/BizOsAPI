const { Router } = require('express');
const c = require('../../controllers/client/purchaseOrderController');
const { roles } = require('../../middleware/client/roles');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

const OBJECT_ID = '[0-9a-fA-F]{24}';

router.use(requireActive);
router.use(roles('owner', 'manager'));

router.get('/', c.list);
router.get(`/:id(${OBJECT_ID})`, c.get);
router.get(`/:id(${OBJECT_ID})/pdf`, c.pdf);

router.post('/', c.create);
router.patch(`/:id(${OBJECT_ID})`, c.update);
router.post(`/:id(${OBJECT_ID})/send`, c.send);
router.post(`/:id(${OBJECT_ID})/receive`, c.receive);
router.post(`/:id(${OBJECT_ID})/cancel`, c.cancel);

module.exports = router;