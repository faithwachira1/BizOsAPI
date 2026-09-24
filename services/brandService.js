const PlatformSetting = require('../models/admin/PlatformSetting');
const cacheService = require('./cacheService');

const CACHE_KEY = 'brand:info';
const TTL = 600;

const DEFAULT_BRAND = {
  name: 'BizOS',
  color: '#0f172a',
  accent: '#2563eb',
  supportEmail: 'support@bizos.co.ke',
  supportPhone: '+254 700 000 000',
  website: 'https://bizos.co.ke',
  logoUrl: null,
};

async function getBrand() {
  const cached = await cacheService.getJson(CACHE_KEY);
  if (cached) return cached;

  const keys = [
    'platform_name',
    'platform_logo_url',
    'support_email',
    'support_phone',
    'platform_website',
  ];

  const docs = await PlatformSetting.find({ key: { $in: keys } }).lean();
  const m = Object.fromEntries(docs.map((d) => [d.key, d.value]));

  const brand = {
    name: m.platform_name || DEFAULT_BRAND.name,
    color: '#0f172a',
    accent: '#2563eb',
    supportEmail: m.support_email || DEFAULT_BRAND.supportEmail,
    supportPhone: m.support_phone || DEFAULT_BRAND.supportPhone,
    website: m.platform_website || DEFAULT_BRAND.website,
    logoUrl: m.platform_logo_url || null,
  };

  await cacheService.setJson(CACHE_KEY, brand, TTL);
  return brand;
}

async function invalidateBrand() {
  await cacheService.del(CACHE_KEY);
}

module.exports = { getBrand, invalidateBrand };