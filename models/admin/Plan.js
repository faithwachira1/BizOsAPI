const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    description: String,
    price: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'KES' },
      interval: { type: String, enum: ['once', 'month', 'year'], default: 'month' },
    },
    limits: {
      maxOwners: { type: Number, default: 1 },
      maxManagers: { type: Number, default: 3 },
      maxCashiers: { type: Number, default: 10 },
      maxProducts: { type: Number, default: 100 },
      maxTransactionsPerMonth: { type: Number, default: 1000 },
      maxAiCallsPerDay: { type: Number, default: 20 },
    },
    features: {
      aiInsights: { type: Boolean, default: false },
      multiLocation: { type: Boolean, default: false },
      api: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      customDomain: { type: Boolean, default: false },
    },
    isPublic: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    trialDays: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
  },
  { timestamps: true }
);

schema.index({ isActive: 1, sortOrder: 1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Plan', schema);