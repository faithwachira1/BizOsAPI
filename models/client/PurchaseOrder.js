const mongoose = require('mongoose');

const STATUSES = ['draft', 'sent', 'received', 'partial', 'cancelled'];

const itemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    sku: String,
    qty: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    receivedQty: { type: Number, default: 0 },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    poNumber: { type: String, required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierSnapshot: {
      name: String,
      phone: String,
      email: String,
      address: String,
    },
    items: { type: [itemSchema], default: [] },
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: STATUSES, default: 'draft' },
    notes: String,
    expectedAt: Date,
    sentAt: Date,
    receivedAt: Date,
    cancelledAt: Date,
    cancelReason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pdfUrl: String,
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, poNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, status: 1 });
schema.index({ tenantId: 1, supplierId: 1 });
schema.index({ tenantId: 1, createdAt: -1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('PurchaseOrder', schema);