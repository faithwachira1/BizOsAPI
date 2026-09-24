const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    category: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    imageUrl: String,
    imagePublicId: String,
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, sku: 1 });
schema.index({ tenantId: 1, barcode: 1 });
schema.index({ tenantId: 1, active: 1 });
schema.index({ tenantId: 1, name: 'text' });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Product', schema);