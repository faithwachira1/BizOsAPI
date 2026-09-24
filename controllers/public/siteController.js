const { asyncHandler } = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const siteService = require('../../services/siteService');
const PlatformSetting = require('../../models/admin/PlatformSetting');
const Plan = require('../../models/admin/Plan');

const getPublicSettings = asyncHandler(async (_req, res) => {
  const settings = await siteService.getSettings();
  return ok(res, settings);
});

const getBusinessTypes = asyncHandler(async (_req, res) => {
  const types = await siteService.getBusinessTypes();
  return ok(res, types);
});

const getCountries = asyncHandler(async (_req, res) => {
  const countries = await siteService.getCountries();
  return ok(res, countries);
});

const getCurrencies = asyncHandler(async (_req, res) => {
  const currencies = await siteService.getCurrencies();
  return ok(res, currencies);
});

const getLegalLinks = asyncHandler(async (_req, res) => {
  const links = await siteService.getLegalLinks();
  return ok(res, links);
});

const getFeatureFlags = asyncHandler(async (_req, res) => {
  const flags = await siteService.getFeatureFlags();
  return ok(res, flags);
});

const getFeatureMap = asyncHandler(async (_req, res) => {
  const map = await siteService.getFeatureMap();
  return ok(res, map);
});

const getPlans = asyncHandler(async (_req, res) => {
  const plans = await Plan.find({ isActive: true, isPublic: true })
    .sort({ sortOrder: 1, code: 1 })
    .select('code name description price limits features trialDays sortOrder')
    .lean();

  return ok(res, plans);
});

const getDownloads = asyncHandler(async (_req, res) => {
  const list = (await PlatformSetting.getValue('downloads', [])) || [];

  const active = list
    .filter((d) => d.isActive)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((d) => ({
      id: d.id,
      name: d.name,
      version: d.version || null,
      link: d.link,
      platform: d.platform,
      description: d.description || null,
    }));

  return ok(res, active);
});

module.exports = {
  getPublicSettings,
  getBusinessTypes,
  getCountries,
  getCurrencies,
  getLegalLinks,
  getFeatureFlags,
  getFeatureMap,
  getPlans,
  getDownloads,
};