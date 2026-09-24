const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    contactName: String,
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: String,
    notes: String,
    totalSpent: { type: Number, default: 0 },
    lastOrderAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, name: 1 });
schema.index({ tenantId: 1, active: 1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Supplier', schema);