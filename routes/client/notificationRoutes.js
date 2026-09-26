const { Router } = require('express');
const c = require('../../controllers/client/notificationController');
const { requireActive } = require('../../middleware/client/statusGuard');

const router = Router();

const OBJECT_ID = '[0-9a-fA-F]{24}';

router.use(requireActive);

router.get('/', c.list);
router.get('/unread-count', c.unread);
router.get('/summary', c.summary);

router.post('/read-all', c.markAllRead);
router.post('/clear-read', c.clearRead);

router.post(`/:id(${OBJECT_ID})/read`, c.markRead);
router.post(`/:id(${OBJECT_ID})/snooze`, c.snooze);
router.post(`/:id(${OBJECT_ID})/unsnooze`, c.unsnooze);
router.post(`/:id(${OBJECT_ID})/archive`, c.archive);
router.delete(`/:id(${OBJECT_ID})`, c.remove);

module.exports = router;