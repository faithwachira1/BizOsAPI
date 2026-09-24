const mongoose = require('mongoose');

const TYPES = ['earn', 'redeem', 'adjust', 'expire', 'refund'];

const schema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    type: { type: String, enum: TYPES, required: true },
    points: { type: Number, required: true },       // signed: +earn/-redeem
    balanceAfter: { type: Number, required: true },
    reason: { type: String, default: null },
    refType: {
      type: String,
      enum: ['sale', 'manual', 'redemption', 'expiry', 'refund', null],
      default: null,
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, customerId: 1, createdAt: -1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('LoyaltyTransaction', schema);