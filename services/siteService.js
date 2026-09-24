const PlatformSetting = require('../models/admin/PlatformSetting');
const Legal = require('../models/admin/Legal');

const PUBLIC_SETTING_KEYS = [
  'platform_name', 'platform_logo_url', 'support_email', 'support_phone',
  'platform_website', 'default_currency', 'default_country', 'default_tax_rate',
  'tax_inclusive', 'min_password_length', 'registration_open', 'maintenance_mode',
  'max_owners_per_tenant', 'cashier_discount_limit', 'cashier_refund_limit',
  'manager_can_invite_cashier', 'require_shift_clock_in',
  'business_types', 'countries', 'currencies',
];

const PUBLIC_FLAG_KEYS = ['registration_open', 'maintenance_mode'];

async function readValue(key, fallback) {
  const doc = await PlatformSetting.findOne({ key }).lean();
  return doc?.value ?? fallback;
}

async function getSettings() {
  const docs = await PlatformSetting.find({ key: { $in: PUBLIC_SETTING_KEYS } }).lean();
  const m = Object.fromEntries(docs.map((d) => [d.key, d.value]));
  return {
    platformName: m.platform_name || 'SmartPOS',
    platformLogoUrl: m.platform_logo_url || null,
    supportEmail: m.support_email || null,
    supportPhone: m.support_phone || null,
    website: m.platform_website || null,
    defaultCurrency: m.default_currency || 'KES',
    defaultCountry: m.default_country || 'KE',
    defaultTaxRate: m.default_tax_rate ?? 0,
    taxInclusive: m.tax_inclusive === true,
    minPasswordLength: m.min_password_length || 8,
    registrationOpen: m.registration_open !== false,
    maintenanceMode: m.maintenance_mode === true,
    maxOwnersPerTenant: m.max_owners_per_tenant ?? 3,
    cashierDiscountLimit: m.cashier_discount_limit ?? 10,
    cashierRefundLimit: m.cashier_refund_limit ?? 0,
    managerCanInviteCashier: m.manager_can_invite_cashier === true,
    requireShiftClockIn: m.require_shift_clock_in === true,
  };
}

async function getBusinessTypes() {
  return (await readValue('business_types', [])) || [];
}

async function getCountries() {
  return (await readValue('countries', [])) || [];
}

async function getCurrencies() {
  return (await readValue('currencies', [])) || [];
}

async function getLegalLinks() {
  const types = ['terms', 'privacy', 'dpa', 'refund', 'aup'];
  const docs = await Legal.find({ type: { $in: types }, isCurrent: true })
    .select('type')
    .lean();

  const links = {};
  for (const d of docs) links[d.type] = `/legal/${d.type}`;
  return links;
}

async function getFeatureFlags() {
  const docs = await PlatformSetting.find({ key: { $in: PUBLIC_FLAG_KEYS } }).lean();
  const m = Object.fromEntries(docs.map((d) => [d.key, d.value]));
  return {
    registrationOpen: m.registration_open !== false,
    maintenanceMode: m.maintenance_mode === true,
  };
}

async function getFeatureMap() {
  const docs = await PlatformSetting.find({ key: /^feature_/ }).lean();
  const out = {};
  for (const d of docs) out[d.key.replace('feature_', '')] = d.value === true;
  return out;
}

module.exports = {
  getSettings,
  getBusinessTypes,
  getCountries,
  getCurrencies,
  getLegalLinks,
  getFeatureFlags,
  getFeatureMap,
};