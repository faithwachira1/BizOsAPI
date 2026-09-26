const notificationService = require('./notificationService');
const { logger } = require('../utils/logger');

async function onLowStock({ tenantId, product, userId = null }) {
  try {
    if (!product) return;

    const isOut = product.stock <= 0;
    await notificationService.createIfNotRecent({
      tenantId,
      userId,
      type: isOut ? 'out_of_stock' : 'low_stock',
      severity: isOut ? 'danger' : 'warning',
      title: isOut ? 'Out of stock' : 'Low stock alert',
      detail: isOut
        ? `${product.name} is out of stock. Reorder immediately.`
        : `${product.name} is down to ${product.stock} units (threshold ${product.lowStockThreshold}).`,
      source: 'Inventory',
      refType: 'product',
      refId: product._id,
      withinHours: 24,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'notification onLowStock failed');
  }
}

async function onPurchaseReceived({ tenantId, po, userId = null }) {
  try {
    if (!po) return;

    await notificationService.createIfNotRecent({
      tenantId,
      userId,
      type: 'po_received',
      severity: 'success',
      title: 'Purchase order received',
      detail: `${po.poNumber} from ${po.supplierSnapshot?.name || 'supplier'} has been received.`,
      source: 'Purchasing',
      refType: 'purchase_order',
      refId: po._id,
      withinHours: 24,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'notification onPurchaseReceived failed');
  }
}

async function onUserInvited({ tenantId, invitedUser, invitedByUserId }) {
  try {
    if (!invitedUser) return;

    await notificationService.create({
      tenantId,
      userId: invitedByUserId || null,
      type: 'user_invited',
      severity: 'info',
      title: 'Team member invited',
      detail: `${invitedUser.fullName || invitedUser.email} was invited as ${invitedUser.role}.`,
      source: 'Team',
      refType: 'user',
      refId: invitedUser._id,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'notification onUserInvited failed');
  }
}

async function onInvitationAccepted({ tenantId, user }) {
  try {
    if (!user) return;

    await notificationService.create({
      tenantId,
      userId: null,
      type: 'invitation_accepted',
      severity: 'success',
      title: 'Invitation accepted',
      detail: `${user.fullName || user.email} joined the team as ${user.role}.`,
      source: 'Team',
      refType: 'user',
      refId: user._id,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'notification onInvitationAccepted failed');
  }
}

async function onInvoiceOverdue({ tenantId, invoice }) {
  try {
    if (!invoice) return;

    await notificationService.createIfNotRecent({
      tenantId,
      userId: null,
      type: 'invoice_overdue',
      severity: 'danger',
      title: 'Invoice overdue',
      detail: `${invoice.invoiceNumber} for ${invoice.customerSnapshot?.name || 'customer'} is overdue.`,
      source: 'Finance',
      refType: 'invoice',
      refId: invoice._id,
      withinHours: 24 * 7,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'notification onInvoiceOverdue failed');
  }
}

async function onSaleVoided({ tenantId, sale, userId }) {
  try {
    if (!sale) return;

    await notificationService.create({
      tenantId,
      userId: null,
      type: 'sale_voided',
      severity: 'warning',
      title: 'Sale voided',
      detail: `${sale.saleNumber} was voided. Reason: ${sale.voidReason || 'unspecified'}.`,
      source: 'Sales',
      refType: 'sale',
      refId: sale._id,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'notification onSaleVoided failed');
  }
}

module.exports = {
  onLowStock,
  onPurchaseReceived,
  onUserInvited,
  onInvitationAccepted,
  onInvoiceOverdue,
  onSaleVoided,
};