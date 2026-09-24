const mongoose = require('mongoose');

const TYPES = ['summarize', 'chat', 'forecast', 'anomaly', 'stock', 'public_chat'];

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
    type: { type: String, enum: TYPES, required: true },
    tokensUsed: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    provider: String,
    success: { type: Boolean, default: true },
    error: String,
    promptPreview: String,
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, createdAt: -1 });
schema.index({ type: 1, createdAt: -1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('AiUsageLog', schema);