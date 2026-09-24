const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    date: { type: Date, required: true },
    totalSales: { type: Number, default: 0 },
    totalTransactions: { type: Number, default: 0 },
    avgBasket: { type: Number, default: 0 },
    grossProfit: { type: Number, default: 0 },
    topProducts: { type: Array, default: [] },
    hourlyBreakdown: { type: Array, default: [] },
    paymentSplit: { type: Object, default: {} },
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, date: 1 }, { unique: true });

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('DailyMetric', schema);