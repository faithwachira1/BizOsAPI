const mongoose = require('mongoose');

const METHODS = ['cash', 'card', 'mpesa', 'paystack', 'flutterwave', 'bank_transfer', 'store_credit'];
const STATUSES = ['pending', 'success', 'failed', 'refunded'];

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    method: { type: String, enum: METHODS, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: STATUSES, default: 'pending' },
    providerRef: String,
    providerPayload: mongoose.Schema.Types.Mixed,
    refundedAt: Date,
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, saleId: 1 });
schema.index({ tenantId: 1, invoiceId: 1 });
schema.index({ tenantId: 1, providerRef: 1 });
schema.index({ tenantId: 1, status: 1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Payment', schema);