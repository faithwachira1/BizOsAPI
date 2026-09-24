const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    sku: String,
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    saleNumber: { type: String, required: true },
    items: { type: [itemSchema], default: [] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, required: true },
    paymentMethod: String,
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partial', 'refunded'], default: 'paid' },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    voided: { type: Boolean, default: false },
    voidReason: String,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidedAt: Date,
    receiptUrl: String,
    receiptPublicId: String,
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, saleNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, createdAt: -1 });
schema.index({ tenantId: 1, cashierId: 1 });
schema.index({ tenantId: 1, customerId: 1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Sale', schema);