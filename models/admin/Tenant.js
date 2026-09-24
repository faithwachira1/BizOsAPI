const mongoose = require('mongoose');

const STATUSES = ['pending_user', 'active', 'rejected', 'suspended', 'expired'];
const BUSINESS_TYPES = ['retail', 'restaurant', 'salon', 'pharmacy', 'other'];

const settingsSchema = new mongoose.Schema(
  {
    // ---- business ----
    phone: { type: String, default: null },
    address: { type: String, default: null },
    taxPin: { type: String, default: null },
    website: { type: String, default: null },
    logoUrl: { type: String, default: null },
    logoPublicId: { type: String, default: null },

    // ---- finance ----
    currency: { type: String, default: 'KES' },
    taxRate: { type: Number, default: 16, min: 0, max: 100 },
    taxInclusive: { type: Boolean, default: false },

    // ---- receipt ----
    receiptTemplate: {
      type: String,
      enum: ['modern', 'detailed', 'minimal'],
      default: 'modern',
    },
    receiptFooter: { type: String, default: 'Thank you for your business.' },
    receiptShowLogo: { type: Boolean, default: true },
    receiptShowTax: { type: Boolean, default: true },
    receiptShowCustomer: { type: Boolean, default: true },
    receiptShowCashier: { type: Boolean, default: false },
    receiptPaperSize: {
      type: String,
      enum: ['58mm', '80mm', 'A4', 'A5'],
      default: '80mm',
    },
    receiptCopies: { type: Number, default: 1, min: 1, max: 5 },

    // ---- loyalty ----
    loyaltyEnabled: { type: Boolean, default: false },
    loyaltyPointsPerCurrency: { type: Number, default: 1, min: 0 },
    loyaltyCurrencyUnit: { type: Number, default: 100, min: 1 },
    loyaltyRedeemRate: { type: Number, default: 1, min: 0 },
    loyaltyMinRedeem: { type: Number, default: 100, min: 0 },

    // ---- payments ----
    paymentMethods: { type: [String], default: [] },

    // ---- appearance ----
    compactMode: { type: Boolean, default: false },
    sounds: { type: Boolean, default: true },
  },
  { _id: false }
);

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
    settings: { type: settingsSchema, default: () => ({}) },
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