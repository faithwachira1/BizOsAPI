const mongoose = require('mongoose');

const CODES = [
  'stripe',
  'mpesa_stk',
  'cash',
  'mpesa_send',
  'mpesa_till',
  'mpesa_paybill',
  'bank',
];

const MODES = ['auto', 'manual'];

const schema = new mongoose.Schema(
  {
    code: { type: String, enum: CODES, required: true, unique: true },
    label: { type: String, required: true },
    mode: { type: String, enum: MODES, required: true },
    enabled: { type: Boolean, default: false },
    requiresApproval: { type: Boolean, default: false },
    config: { type: Object, default: {} },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

schema.index({ enabled: 1, order: 1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('PaymentMethod', schema);