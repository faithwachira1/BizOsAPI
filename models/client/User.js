const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const ROLES = ['owner', 'manager', 'cashier'];
const STATUSES = ['pending_user', 'active', 'invited', 'rejected', 'suspended'];

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: STATUSES, default: 'pending_user' },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, email: 1 }, { unique: true });
schema.index({ tenantId: 1, role: 1 });
schema.index({ tenantId: 1, status: 1 });

schema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

schema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  if (this.passwordHash.startsWith('$2')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

schema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', schema);