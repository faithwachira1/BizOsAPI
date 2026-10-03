const { Router } = require('express');
const c = require('../../controllers/admin/backupController');

const router = Router();

router.get('/', c.list);
router.post('/', c.createNow);

router.get('/settings', c.getSettings);
router.put('/settings', c.updateSettings);

router.get('/:id', c.get);
router.get('/:id/download', c.download);
router.post('/:id/email', c.sendEmail);
router.post('/:id/restore', c.restore);
router.delete('/:id', c.remove);

module.exports = router;