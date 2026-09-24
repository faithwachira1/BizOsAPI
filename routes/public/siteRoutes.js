const { Router } = require('express');
const c = require('../../controllers/public/siteController');

const router = Router();

router.get('/settings', c.getPublicSettings);
router.get('/business-types', c.getBusinessTypes);
router.get('/countries', c.getCountries);
router.get('/currencies', c.getCurrencies);
router.get('/legal-links', c.getLegalLinks);
router.get('/feature-flags', c.getFeatureFlags);
router.get('/features', c.getFeatureMap);
router.get('/plans', c.getPlans);
router.get('/downloads', c.getDownloads);

module.exports = router;