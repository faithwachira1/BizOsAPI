const mongoose = require('mongoose');

const STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'];

const itemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    name: { type: String, required: true },
    description: { type: String, default: null },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    invoiceNumber: { type: String, required: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerSnapshot: {
      name: { type: String, required: true },
      email: { type: String, default: null },
      phone: { type: String, default: null },
      address: { type: String, default: null },
    },

    items: { type: [itemSchema], default: [] },

    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, required: true },
    currency: { type: String, required: true },

    status: { type: String, enum: STATUSES, default: 'draft' },

    dueDate: { type: Date, default: null },
    issuedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },

    paymentMethod: { type: String, default: null },
    paymentRef: { type: String, default: null },

    paymentInstructions: { type: Array, default: [] },

    stkLastRequest: {
      checkoutRequestId: { type: String, default: null },
      phone: { type: String, default: null },
      requestedAt: { type: Date, default: null },
    },

    remindersSent: { type: Number, default: 0 },
    lastReminderAt: { type: Date, default: null },

    notes: { type: String, default: null },

    pdfUrl: { type: String, default: null },
    pdfPublicId: { type: String, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, status: 1 });
schema.index({ tenantId: 1, customerId: 1 });
schema.index({ tenantId: 1, dueDate: 1 });
schema.index({ tenantId: 1, createdAt: -1 });
schema.index({ 'stkLastRequest.checkoutRequestId': 1 }, { sparse: true });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Invoice', schema);