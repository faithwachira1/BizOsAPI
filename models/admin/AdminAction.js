const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', required: true, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
    action: { type: String, required: true },
    reason: String,
    metadata: mongoose.Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true }
);

schema.index({ adminId: 1, createdAt: -1 });
schema.index({ tenantId: 1, createdAt: -1 });
schema.index({ action: 1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('AdminAction', schema);