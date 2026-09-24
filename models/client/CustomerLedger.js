const mongoose = require('mongoose');

const TYPES = ['invoice', 'payment', 'adjustment', 'refund', 'writeoff'];

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

    amount: { type: Number, required: true },

    balanceAfter: { type: Number, required: true },

    refType: {
      type: String,
      enum: ['invoice', 'payment', 'manual', null],
      default: null,
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },

    description: { type: String, default: null },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
schema.index({ tenantId: 1, type: 1 });
schema.index({ tenantId: 1, refType: 1, refId: 1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('CustomerLedger', schema);