const mongoose = require('mongoose');

const TYPES = ['manual', 'auto'];
const STATUSES = ['running', 'success', 'failed', 'expired'];

const schema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    publicId: { type: String, default: null },
    url: { type: String, default: null },
    sizeBytes: { type: Number, default: 0 },
    checksum: { type: String, default: null },
    type: { type: String, enum: TYPES, required: true },
    status: { type: String, enum: STATUSES, default: 'running' },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', default: null },
    error: { type: String, default: null },
    collections: { type: [String], default: [] },
    recordCounts: { type: Object, default: {} },
    retentionUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ status: 1, startedAt: -1 });
schema.index({ type: 1, startedAt: -1 });
schema.index({ retentionUntil: 1 });
schema.index({ publicId: 1 }, { sparse: true });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Backup', schema);