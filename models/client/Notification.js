const mongoose = require('mongoose');

const TYPES = [
  'low_stock',
  'out_of_stock',
  'po_received',
  'user_invited',
  'invitation_accepted',
  'invoice_overdue',
  'sale_voided',
  'system',
];

const SEVERITIES = ['info', 'success', 'warning', 'danger'];

const REF_TYPES = [
  'product',
  'purchase_order',
  'user',
  'invitation',
  'invoice',
  'sale',
  null,
];

const schema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    type: { type: String, enum: TYPES, required: true },
    severity: { type: String, enum: SEVERITIES, default: 'info' },

    title: { type: String, required: true },
    detail: { type: String, default: '' },
    source: { type: String, default: 'System' },

    refType: { type: String, enum: REF_TYPES, default: null },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },

    readAt: { type: Date, default: null },
    snoozedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, userId: 1, archivedAt: 1, createdAt: -1 });
schema.index({ tenantId: 1, userId: 1, readAt: 1, archivedAt: 1 });
schema.index({ tenantId: 1, refType: 1, refId: 1, type: 1 });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Notification', schema);