const mongoose = require('mongoose');

const TYPES = ['in', 'out', 'adjustment', 'purchase', 'purchase_return', 'invoice', 'invoice_return', 'sale', 'sale_return'];

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    type: { type: String, enum: TYPES, required: true },
    qty: { type: Number, required: true },
    reason: String,
    refType: { type: String, enum: ['sale', 'purchase_order', 'invoice', 'manual', null], default: null },
    refId: mongoose.Schema.Types.ObjectId,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    balanceAfter: Number,
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, productId: 1, createdAt: -1 });
schema.index({ tenantId: 1, type: 1 });
schema.index({ tenantId: 1, refType: 1, refId: 1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('InventoryMovement', schema);