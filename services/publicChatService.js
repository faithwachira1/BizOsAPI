const { chat } = require('./aiService');
const PlatformSetting = require('../models/admin/PlatformSetting');
const cacheService = require('./cacheService');
const { getRedis } = require('../config/redis');
const { logger } = require('../utils/logger');

const RATE_LIMIT_PER_IP = 30;
const WINDOW_SEC = 3600;
const PROMPT_CACHE_KEY = 'chat:public:system_prompt';
const PROMPT_TTL = 300;

async function buildSystemPrompt() {
  const cached = await cacheService.get(PROMPT_CACHE_KEY);
  if (cached) return cached;

  const [platformName, supportEmail, supportPhone, website] = await Promise.all([
    PlatformSetting.getValue('platform_name', 'BizOS'),
    PlatformSetting.getValue('support_email', null),
    PlatformSetting.getValue('support_phone', null),
    PlatformSetting.getValue('platform_website', null),
  ]);

  const lines = [];
  lines.push(
    `You are the AI assistant on ${platformName}'s landing page. ${platformName} is a point-of-sale platform for small businesses.`
  );
  lines.push('');
  lines.push('Core features:');
  lines.push('- Point of sale (cash, card, M-Pesa)');
  lines.push('- Inventory and stock management');
  lines.push('- Staff roles (owner, manager, cashier)');
  lines.push('- Suppliers and purchase orders');
  lines.push('- Invoices to customers');
  lines.push('- AI business insights');
  lines.push('- Multi-location support');
  lines.push('');
  lines.push('You only answer questions about the platform itself.');
  lines.push('Do not invent features that are not listed.');
  lines.push('If asked about something you do not know, suggest contacting support.');
  lines.push('');
  if (supportEmail) lines.push(`Support email: ${supportEmail}`);
  if (supportPhone) lines.push(`Support phone: ${supportPhone}`);
  if (website) lines.push(`Website: ${website}`);

  const prompt = lines.join('\n');
  await cacheService.set(PROMPT_CACHE_KEY, prompt, PROMPT_TTL);
  return prompt;
}

async function invalidatePromptCache() {
  await cacheService.del(PROMPT_CACHE_KEY);
}

async function checkRateLimit(ip) {
  const redis = getRedis();
  if (!redis) return true;
  const key = `chat:public:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, WINDOW_SEC);
  return count <= RATE_LIMIT_PER_IP;
}

async function reply({ text, ip }) {
  if (!text || !text.trim()) {
    return { reply: 'Please type a question.' };
  }

  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return { reply: 'Too many messages. Please try again later.' };
  }

  try {
    const systemPrompt = await buildSystemPrompt();
    const { reply: answer, tokensUsed } = await chat(text, systemPrompt, {
      type: 'public_chat',
    });
    return { reply: answer, tokensUsed };
  } catch (err) {
    logger.error({ err: err.message, ip }, 'publicChat failed');
    const fallback = await PlatformSetting.getValue('support_email', 'support@bizos.co.ke');
    return { reply: `Sorry, I'm having trouble right now. Email ${fallback}` };
  }
}

module.exports = { reply, buildSystemPrompt, invalidatePromptCache };