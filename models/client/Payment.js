const mongoose = require('mongoose');

const METHODS = ['cash', 'card', 'mpesa', 'mpesa_stk', 'mpesa_send', 'mpesa_till', 'mpesa_paybill', 'paystack', 'flutterwave', 'bank', 'bank_transfer', 'store_credit'];
const STATUSES = ['pending', 'success', 'failed', 'refunded'];
const PURPOSES = ['sale', 'invoice', 'subscription'];

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    purpose: { type: String, enum: PURPOSES, default: 'sale', index: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    method: { type: String, enum: METHODS, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: STATUSES, default: 'pending' },
    providerRef: { type: String, index: true },
    providerPayload: mongoose.Schema.Types.Mixed,
    mpesaReceipt: { type: String, default: null, index: true },
    paidAt: { type: Date, default: null },
    failureReason: { type: String, default: null },
    refundedAt: Date,
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, saleId: 1 });
schema.index({ tenantId: 1, invoiceId: 1 });
schema.index({ tenantId: 1, providerRef: 1 });
schema.index({ tenantId: 1, mpesaReceipt: 1 }, { sparse: true });
schema.index({ tenantId: 1, status: 1 });
schema.index({ tenantId: 1, purpose: 1, createdAt: -1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Payment', schema);