const mongoose = require('mongoose');

const TYPES = ['terms', 'privacy', 'dpa', 'refund', 'aup'];

const schema = new mongoose.Schema(
  {
    type: { type: String, enum: TYPES, required: true },
    version: { type: Number, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    contentHash: String,
    locale: { type: String, default: 'en' },
    effectiveAt: Date,
    publishedAt: Date,
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

schema.index({ type: 1, version: 1 }, { unique: true });
schema.index({ type: 1, isCurrent: 1 });
schema.index({ effectiveAt: -1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Legal', schema);