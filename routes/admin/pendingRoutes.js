const { Router } = require('express');
const c = require('../../controllers/admin/pendingController');

const router = Router();

router.get('/', c.list);
router.get('/:id', c.get);
router.post('/:id/approve', c.approve);
router.post('/:id/reject', c.reject);
router.post('/:id/confirm-payment', c.confirmPayment);
router.post('/:id/notes', c.addNotes);

module.exports = router;