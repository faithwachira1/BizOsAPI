const { Router } = require('express');
const c = require('../../controllers/public/invoiceController');

const router = Router();

router.get('/:number', c.getByNumber);

module.exports = router;