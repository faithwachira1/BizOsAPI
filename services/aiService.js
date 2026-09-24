const { hdmAi, HDM_AI_ENDPOINTS } = require('../config/hdmai');
const AiUsageLog = require('../models/admin/AiUsageLog');
const { ApiError } = require('../utils/apiError');
const { logger } = require('../utils/logger');

async function chat(message, systemPrompt, meta = {}) {
  const t0 = Date.now();

  try {
    const res = await hdmAi.post(HDM_AI_ENDPOINTS.PUBLIC_CHAT, {
      message,
      system_prompt: systemPrompt,
    });

    if (!res.data?.success) {
      throw new Error(res.data?.error || 'HDM AI unsuccessful');
    }

    const { reply, tokens_used, provider } = res.data.data;
    const latencyMs = Date.now() - t0;

    AiUsageLog.create({
      tenantId: meta.tenantId || null,
      type: meta.type || 'chat',
      tokensUsed: tokens_used || 0,
      latencyMs,
      provider: provider || 'unknown',
      success: true,
      promptPreview: String(systemPrompt).slice(0, 200),
    }).catch((e) => logger.error({ err: e.message }, 'aiUsageLog failed'));

    return { reply, tokensUsed: tokens_used || 0, provider, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - t0;

    AiUsageLog.create({
      tenantId: meta.tenantId || null,
      type: meta.type || 'chat',
      latencyMs,
      success: false,
      error: err.message,
      promptPreview: String(systemPrompt).slice(0, 200),
    }).catch((e) => logger.error({ err: e.message }, 'aiUsageLog failed'));

    logger.error({ err: err.message, latencyMs }, 'hdm ai failed');
    throw ApiError.badRequest('AI_FAILED', 'AI service unavailable');
  }
}

module.exports = { chat };