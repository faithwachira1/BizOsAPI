const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: String,
    notes: String,
    totalSpent: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0, min: 0 },
    lastPurchaseAt: Date,
    active: { type: Boolean, default: true },

    points: { type: Number, default: 0, min: 0 },
    pointsUpdatedAt: { type: Date, default: null },
    loyaltyTier: {
      type: String,
      enum: ['none', 'bronze', 'silver', 'gold'],
      default: 'none',
    },
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, phone: 1 });
schema.index({ tenantId: 1, email: 1 });
schema.index({ tenantId: 1, name: 1 });
schema.index({ tenantId: 1, points: -1 });
schema.index({ tenantId: 1, outstanding: -1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Customer', schema);