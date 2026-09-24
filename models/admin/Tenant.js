const mongoose = require('mongoose');

const STATUSES = ['pending_user', 'active', 'rejected', 'suspended', 'expired'];
const BUSINESS_TYPES = ['retail', 'restaurant', 'salon', 'pharmacy', 'other'];

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    country: { type: String, required: true },
    businessType: { type: String, enum: BUSINESS_TYPES, required: true },
    status: { type: String, enum: STATUSES, default: 'pending_user' },
    planId: { type: String, default: 'free' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    registeredAt: { type: Date, default: Date.now },
    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
    rejectedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
    rejectionReason: String,
    suspendedAt: Date,
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
    suspendedReason: String,
    expiresAt: Date,
    settings: { type: Object, default: {} },
  },
  { timestamps: true }
);

schema.index({ status: 1 });
schema.index({ status: 1, registeredAt: -1 });
schema.index({ country: 1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Tenant', schema);