function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function layout(brand, { title, preheader = '', body, cta }) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(preheader)}</span>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f1f5f9;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:${brand.color};padding:20px 28px;">
            ${brand.logoUrl
              ? `<img src="${brand.logoUrl}" alt="${escapeHtml(brand.name)}" style="height:32px;display:block;">`
              : `<span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:0.2px;">${escapeHtml(brand.name)}</span>`}
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px 8px 28px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#0f172a;">${escapeHtml(title)}</h1>
            <div style="font-size:15px;line-height:1.6;color:#334155;">${body}</div>
          </td>
        </tr>
        ${cta ? `
        <tr>
          <td style="padding:16px 28px 8px 28px;">
            <a href="${cta.url}" style="display:inline-block;background:${brand.accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">${escapeHtml(cta.label)}</a>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding:24px 28px 0 28px;">
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;">
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px 28px;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">Need help? Contact us:</p>
            ${brand.supportEmail ? `<p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">
              <a href="mailto:${brand.supportEmail}" style="color:${brand.accent};text-decoration:none;">${brand.supportEmail}</a>
            </p>` : ''}
            ${brand.supportPhone ? `<p style="margin:0 0 12px 0;font-size:13px;color:#64748b;">
              <a href="tel:${brand.supportPhone.replace(/\s+/g, '')}" style="color:${brand.accent};text-decoration:none;">${brand.supportPhone}</a>
            </p>` : ''}
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              © ${new Date().getFullYear()} ${escapeHtml(brand.name)}${brand.website ? ` · <a href="${brand.website}" style="color:#94a3b8;text-decoration:none;">${brand.website}</a>` : ''}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function cta(url, label) {
  return { url, label };
}

function plain(lines) {
  return lines.filter(Boolean).join('\n');
}

function footer(brand) {
  return plain([
    '',
    '—',
    'Need help?',
    brand.supportEmail ? `Email: ${brand.supportEmail}` : '',
    brand.supportPhone ? `Phone: ${brand.supportPhone}` : '',
    brand.website || '',
  ]);
}

function money(amount, currency) {
  return `${currency} ${Number(amount).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function methodLabel(code) {
  if (!code) return null;
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanDate(d) {
  const date = d ? new Date(d) : new Date();
  return date.toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nairobi',
  });
}

/* ─── AUTH ─── */

const verification = ({ brand, name, verifyUrl, expiresIn = '24 hours' }) => ({
  subject: `Verify your ${brand.name} account`,
  html: layout(brand, {
    title: 'Verify your email',
    preheader: `Confirm your ${brand.name} account`,
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
           <p style="margin:0 0 12px 0;">Click the button below to verify your email address.</p>
           <p style="margin:0;color:#64748b;font-size:13px;">This link expires in ${escapeHtml(expiresIn)}.</p>`,
    cta: cta(verifyUrl, 'Verify email'),
  }),
  text: plain([
    `Hi ${name},`,
    '',
    `Verify your ${brand.name} account:`,
    verifyUrl,
    '',
    `Link expires in ${expiresIn}.`,
    footer(brand),
  ]),
});

const passwordReset = ({ brand, fullName, resetUrl, expiresIn = '1 hour' }) => ({
  subject: `Reset your ${brand.name} password`,
  html: layout(brand, {
    title: 'Reset your password',
    preheader: 'Password reset requested',
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(fullName)},</p>
           <p style="margin:0 0 12px 0;">Click the button below to reset your password.</p>
           <p style="margin:0;color:#64748b;font-size:13px;">This link expires in ${escapeHtml(expiresIn)}. If you didn't request this, ignore this email.</p>`,
    cta: cta(resetUrl, 'Reset password'),
  }),
  text: plain([`Hi ${fullName},`, '', `Reset your password: ${resetUrl}`, '', `Expires in ${expiresIn}.`, footer(brand)]),
});

const passwordChanged = ({ brand, fullName, when, ip }) => ({
  subject: 'Your password was changed',
  html: layout(brand, {
    title: 'Password changed',
    preheader: 'Your password was changed',
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(fullName)},</p>
           <p style="margin:0 0 12px 0;">Your ${escapeHtml(brand.name)} password was changed.</p>
           <p style="margin:0;color:#64748b;font-size:13px;">When: ${escapeHtml(when || new Date().toISOString())}${ip ? ` · IP: ${escapeHtml(ip)}` : ''}</p>
           <p style="margin:12px 0 0 0;color:#64748b;font-size:13px;">If this wasn't you, contact support immediately.</p>`,
  }),
  text: plain([`Hi ${fullName},`, '', 'Your password was changed.', `When: ${when || new Date().toISOString()}`, footer(brand)]),
});

/* ─── REGISTRATION ─── */

const registrationReceived = ({ brand, name, businessName, planName, amount, currency, dueDate, invoiceNumber, paymentLink, supportEmail }) => ({
  subject: `We received your registration — ${businessName}`,
  html: layout(brand, {
    title: 'Registration received',
    preheader: `Thank you for registering ${businessName}`,
    body: `
      <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>

      <p style="margin:0 0 12px 0;">
        Thank you for registering <strong>${escapeHtml(businessName)}</strong> on ${escapeHtml(brand.name)}.
      </p>

      <p style="margin:0 0 16px 0;">
        Your registration is now with our team for review. We'll notify you by email once it's been approved — usually within a few hours.
      </p>

      ${amount > 0 ? `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">Action required</p>
          <p style="margin:0 0 12px 0;font-size:14px;color:#78350f;">
            Please pay <strong>${escapeHtml(money(amount, currency))}</strong> for the <strong>${escapeHtml(planName)}</strong> plan to secure your account.
          </p>
          <p style="margin:0 0 4px 0;font-size:12px;color:#92400e;">Invoice</p>
          <p style="margin:0 0 12px 0;font-size:14px;font-family:monospace;color:#78350f;">${escapeHtml(invoiceNumber)}</p>
          <p style="margin:0 0 4px 0;font-size:12px;color:#92400e;">Pay before</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:#78350f;">${escapeHtml(dueDate)}</p>
        </td></tr>
      </table>

      <p style="margin:0 0 12px 0;font-size:13px;color:#64748b;">
        If payment is not received within this window, your registration may be cancelled.
      </p>
      ` : ''}

      <p style="margin:0 0 12px 0;">
        You'll receive a separate invoice email with the full breakdown.
      </p>

      <p style="margin:0 0 12px 0;">
        Questions? Reply to this email or reach us at ${escapeHtml(supportEmail || brand.supportEmail)}.
      </p>

      <p style="margin:0;">— The ${escapeHtml(brand.name)} Team</p>
    `,
    cta: paymentLink ? cta(paymentLink, 'Pay invoice') : undefined,
  }),
  text: plain([
    `Hi ${name},`,
    '',
    `Thank you for registering ${businessName} on ${brand.name}.`,
    '',
    'Your registration is now with our team for review. We will notify you by email once it has been approved — usually within a few hours.',
    '',
    amount > 0 ? `Action required: pay ${money(amount, currency)} for the ${planName} plan.` : '',
    amount > 0 ? `Invoice: ${invoiceNumber}` : '',
    amount > 0 ? `Pay before: ${dueDate}` : '',
    amount > 0 ? '' : '',
    amount > 0 ? 'If payment is not received within this window, your registration may be cancelled.' : '',
    amount > 0 ? '' : '',
    'You will receive a separate invoice email with the full breakdown.',
    '',
    `Questions? Contact ${supportEmail || brand.supportEmail}.`,
    '',
    `— The ${brand.name} Team`,
    footer(brand),
  ]),
});

const welcome = ({ brand, name, businessName, email, temporaryPassword, loginUrl }) => ({
  subject: `Welcome to ${brand.name} — ${businessName} is active`,
  html: layout(brand, {
    title: `Welcome to ${brand.name}`,
    preheader: `${businessName} is approved and ready`,
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
           <p style="margin:0 0 12px 0;"><strong>${escapeHtml(businessName)}</strong> has been approved and is ready to use.</p>
           ${email ? `
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">Login credentials</p>
               <p style="margin:0 0 4px 0;font-size:14px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
               <p style="margin:0;font-size:14px;"><strong>Password:</strong> ${escapeHtml(temporaryPassword || '(use the password you set)')}</p>
             </td></tr>
           </table>` : ''}
           <p style="margin:0;">Log in and start selling.</p>`,
    cta: cta(loginUrl, 'Go to dashboard'),
  }),
  text: plain([
    `Hi ${name},`,
    '',
    `${businessName} has been approved.`,
    email ? `Login email: ${email}` : '',
    temporaryPassword ? `Temporary password: ${temporaryPassword}` : '',
    '',
    `Log in: ${loginUrl}`,
    footer(brand),
  ]),
});

const rejection = ({ brand, name, businessName, reason }) => ({
  subject: `Your ${brand.name} registration was not approved`,
  html: layout(brand, {
    title: 'Registration not approved',
    preheader: 'Your registration status',
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
           <p style="margin:0 0 12px 0;">Registration for <strong>${escapeHtml(businessName)}</strong> was not approved.</p>
           <p style="margin:0 0 12px 0;color:#64748b;font-size:13px;">Reason: ${escapeHtml(reason || 'Not specified')}</p>
           <p style="margin:0;">If you believe this is a mistake, contact support.</p>`,
  }),
  text: plain([
    `Hi ${name},`,
    '',
    `Registration for ${businessName} was not approved.`,
    `Reason: ${reason || 'Not specified'}`,
    footer(brand),
  ]),
});

const pendingReminder = ({ brand, name, businessName, daysLeft }) => ({
  subject: `Your ${brand.name} registration expires in ${daysLeft} days`,
  html: layout(brand, {
    title: 'Registration expiring soon',
    preheader: `${businessName} will expire in ${daysLeft} days`,
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
           <p style="margin:0 0 12px 0;">Your registration for <strong>${escapeHtml(businessName)}</strong> expires in <strong>${escapeHtml(String(daysLeft))}</strong> day${daysLeft === 1 ? '' : 's'}.</p>
           <p style="margin:0;">Contact support if you need help completing approval.</p>`,
  }),
  text: plain([`Hi ${name},`, '', `Registration for ${businessName} expires in ${daysLeft} days.`, footer(brand)]),
});

const pendingExpired = ({ brand, name, businessName }) => ({
  subject: `Your ${brand.name} registration expired`,
  html: layout(brand, {
    title: 'Registration expired',
    preheader: `${businessName} was not approved in time`,
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
           <p style="margin:0 0 12px 0;">The registration for <strong>${escapeHtml(businessName)}</strong> has expired because it was not approved in time.</p>
           <p style="margin:0;">Contact support if you'd like to re-register.</p>`,
  }),
  text: plain([`Hi ${name},`, '', `Registration for ${businessName} expired.`, footer(brand)]),
});

/* ─── STAFF ─── */

const staffWelcome = ({ brand, fullName, businessName, email, temporaryPassword, role, loginUrl }) => ({
  subject: `You've been added to ${businessName}`,
  html: layout(brand, {
    title: `Welcome to ${businessName}`,
    preheader: `Your ${role} account is ready`,
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(fullName)},</p>
           <p style="margin:0 0 12px 0;">${escapeHtml(businessName)} has added you as <strong>${escapeHtml(role)}</strong> on ${escapeHtml(brand.name)}.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">Login credentials</p>
               <p style="margin:0 0 4px 0;font-size:14px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
               <p style="margin:0;font-size:14px;"><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</p>
             </td></tr>
           </table>
           <p style="margin:0;">You'll be asked to change your password on first login.</p>`,
    cta: cta(loginUrl, 'Log in'),
  }),
  text: plain([
    `Hi ${fullName},`,
    '',
    `${businessName} added you as ${role}.`,
    `Email: ${email}`,
    `Temporary password: ${temporaryPassword}`,
    '',
    `Log in: ${loginUrl}`,
    footer(brand),
  ]),
});

const staffDeactivated = ({ brand, fullName, businessName }) => ({
  subject: `Your access to ${businessName} was removed`,
  html: layout(brand, {
    title: 'Account deactivated',
    preheader: 'Your access has been removed',
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(fullName)},</p>
           <p style="margin:0;">Your access to <strong>${escapeHtml(businessName)}</strong> on ${escapeHtml(brand.name)} has been removed.</p>`,
  }),
  text: plain([`Hi ${fullName},`, '', `Your access to ${businessName} has been removed.`, footer(brand)]),
});

const roleChanged = ({ brand, fullName, businessName, oldRole, newRole }) => ({
  subject: `Your role at ${businessName} changed`,
  html: layout(brand, {
    title: 'Role updated',
    preheader: `You are now ${newRole}`,
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(fullName)},</p>
           <p style="margin:0;">Your role at <strong>${escapeHtml(businessName)}</strong> changed from <strong>${escapeHtml(oldRole)}</strong> to <strong>${escapeHtml(newRole)}</strong>.</p>`,
  }),
  text: plain([`Hi ${fullName},`, '', `Your role at ${businessName} changed: ${oldRole} → ${newRole}`, footer(brand)]),
});

/* ─── OPERATIONS ─── */

const lowStockAlert = ({ brand, businessName, productName, qty, threshold, productUrl }) => ({
  subject: `Low stock: ${productName}`,
  html: layout(brand, {
    title: 'Low stock alert',
    preheader: `${productName} is running low`,
    body: `<p style="margin:0 0 12px 0;"><strong>${escapeHtml(productName)}</strong> is running low at <strong>${escapeHtml(businessName)}</strong>.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 4px 0;font-size:13px;color:#92400e;">Current stock</p>
               <p style="margin:0 0 12px 0;font-size:18px;font-weight:600;color:#78350f;">${escapeHtml(String(qty))}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#92400e;">Threshold</p>
               <p style="margin:0;font-size:14px;color:#78350f;">${escapeHtml(String(threshold))}</p>
             </td></tr>
           </table>`,
    cta: productUrl ? cta(productUrl, 'View product') : undefined,
  }),
  text: plain([`Low stock at ${businessName}: ${productName}`, `Current: ${qty} · Threshold: ${threshold}`, productUrl || '', footer(brand)]),
});

const outOfStock = ({ brand, businessName, productName, productUrl }) => ({
  subject: `Out of stock: ${productName}`,
  html: layout(brand, {
    title: 'Out of stock',
    preheader: `${productName} is out of stock`,
    body: `<p style="margin:0 0 12px 0;"><strong>${escapeHtml(productName)}</strong> is out of stock at <strong>${escapeHtml(businessName)}</strong>.</p>
           <p style="margin:0;">Restock soon to avoid missing sales.</p>`,
    cta: productUrl ? cta(productUrl, 'View product') : undefined,
  }),
  text: plain([`Out of stock at ${businessName}: ${productName}`, productUrl || '', footer(brand)]),
});

const dailySummary = ({ brand, businessName, date, totalSales, totalTransactions, avgBasket, currency, topProducts, insightsUrl }) => ({
  subject: `Daily summary — ${date}`,
  html: layout(brand, {
    title: `Daily summary — ${date}`,
    preheader: `${currency} ${totalSales} across ${totalTransactions} sales`,
    body: `<p style="margin:0 0 16px 0;">Here's how <strong>${escapeHtml(businessName)}</strong> did on ${escapeHtml(date)}.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Total sales</p>
               <p style="margin:0 0 12px 0;font-size:18px;font-weight:600;">${escapeHtml(currency)} ${escapeHtml(String(totalSales))}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Transactions</p>
               <p style="margin:0 0 12px 0;font-size:14px;">${escapeHtml(String(totalTransactions))}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Average basket</p>
               <p style="margin:0;font-size:14px;">${escapeHtml(currency)} ${escapeHtml(String(avgBasket))}</p>
             </td></tr>
           </table>
           ${topProducts?.length ? `
           <p style="margin:16px 0 8px 0;font-size:13px;color:#64748b;">Top products</p>
           <ul style="margin:0;padding-left:20px;font-size:14px;color:#334155;">
             ${topProducts.map((p) => `<li style="margin-bottom:6px;">${escapeHtml(p.name)} — ${escapeHtml(String(p.qty))} sold</li>`).join('')}
           </ul>` : ''}`,
    cta: insightsUrl ? cta(insightsUrl, 'View insights') : undefined,
  }),
  text: plain([
    `Daily summary for ${businessName} — ${date}`,
    `Sales: ${currency} ${totalSales} · ${totalTransactions} transactions · avg ${currency} ${avgBasket}`,
    ...(topProducts || []).map((p) => `- ${p.name}: ${p.qty}`),
    insightsUrl || '',
    footer(brand),
  ]),
});

const weeklyReport = ({ brand, businessName, weekStart, weekEnd, totalSales, totalTransactions, topProducts, lowStock, currency, reportUrl }) => ({
  subject: `Weekly report — ${weekStart} to ${weekEnd}`,
  html: layout(brand, {
    title: 'Weekly report',
    preheader: `${currency} ${totalSales} this week`,
    body: `<p style="margin:0 0 16px 0;">Weekly summary for <strong>${escapeHtml(businessName)}</strong>.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Total sales</p>
               <p style="margin:0 0 12px 0;font-size:18px;font-weight:600;">${escapeHtml(currency)} ${escapeHtml(String(totalSales))}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Transactions</p>
               <p style="margin:0;font-size:14px;">${escapeHtml(String(totalTransactions))}</p>
             </td></tr>
           </table>
           ${topProducts?.length ? `
           <p style="margin:16px 0 8px 0;font-size:13px;color:#64748b;">Top products</p>
           <ul style="margin:0;padding-left:20px;font-size:14px;color:#334155;">
             ${topProducts.map((p) => `<li style="margin-bottom:6px;">${escapeHtml(p.name)} — ${escapeHtml(String(p.qty))} sold</li>`).join('')}
           </ul>` : ''}
           ${lowStock?.length ? `
           <p style="margin:16px 0 8px 0;font-size:13px;color:#64748b;">Low stock</p>
           <ul style="margin:0;padding-left:20px;font-size:14px;color:#334155;">
             ${lowStock.map((p) => `<li style="margin-bottom:6px;">${escapeHtml(p.name)} — ${escapeHtml(String(p.qty))} left</li>`).join('')}
           </ul>` : ''}`,
    cta: reportUrl ? cta(reportUrl, 'View full report') : undefined,
  }),
  text: plain([
    `Weekly report for ${businessName}`,
    `${weekStart} → ${weekEnd}`,
    `Sales: ${currency} ${totalSales} · ${totalTransactions} transactions`,
    ...(topProducts || []).map((p) => `- ${p.name}: ${p.qty}`),
    reportUrl || '',
    footer(brand),
  ]),
});

/* ─── SUBSCRIPTION ─── */

const subscriptionPaid = ({ brand, businessName, planName, amount, currency, periodStart, periodEnd, reference }) => ({
  subject: `Subscription payment received — ${money(amount, currency)}`,
  html: layout(brand, {
    title: 'Subscription payment received',
    preheader: `${planName} renewed`,
    body: `<p style="margin:0 0 16px 0;">Your subscription payment for <strong>${escapeHtml(businessName)}</strong> was received.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Plan</p>
               <p style="margin:0 0 12px 0;font-size:15px;font-weight:600;">${escapeHtml(planName)}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Amount</p>
               <p style="margin:0 0 12px 0;font-size:15px;font-weight:600;">${escapeHtml(money(amount, currency))}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Period</p>
               <p style="margin:0 0 12px 0;font-size:14px;">${escapeHtml(periodStart)} → ${escapeHtml(periodEnd)}</p>
               ${reference ? `<p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Reference</p>
               <p style="margin:0;font-size:14px;">${escapeHtml(reference)}</p>` : ''}
             </td></tr>
           </table>`,
  }),
  text: plain([`Subscription paid for ${businessName}.`, `Plan: ${planName}`, `Amount: ${money(amount, currency)}`, `Period: ${periodStart} → ${periodEnd}`, footer(brand)]),
});

const subscriptionExpiring = ({ brand, businessName, planName, daysLeft, expiresAt, renewUrl }) => ({
  subject: `Subscription expiring in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
  html: layout(brand, {
    title: 'Subscription expiring soon',
    preheader: `${planName} expires ${expiresAt}`,
    body: `<p style="margin:0 0 12px 0;">Your <strong>${escapeHtml(planName)}</strong> plan for <strong>${escapeHtml(businessName)}</strong> expires in <strong>${escapeHtml(String(daysLeft))}</strong> day${daysLeft === 1 ? '' : 's'}.</p>
           <p style="margin:0;">Renew now to avoid interruption.</p>`,
    cta: renewUrl ? cta(renewUrl, 'Renew subscription') : undefined,
  }),
  text: plain([`${planName} for ${businessName} expires in ${daysLeft} day(s).`, renewUrl || '', footer(brand)]),
});

const subscriptionExpired = ({ brand, businessName, planName, renewUrl }) => ({
  subject: 'Your subscription has expired',
  html: layout(brand, {
    title: 'Subscription expired',
    preheader: `${planName} has expired`,
    body: `<p style="margin:0 0 12px 0;">Your <strong>${escapeHtml(planName)}</strong> subscription for <strong>${escapeHtml(businessName)}</strong> has expired.</p>
           <p style="margin:0;">Renew to restore full access.</p>`,
    cta: renewUrl ? cta(renewUrl, 'Renew now') : undefined,
  }),
  text: plain([`Subscription for ${businessName} expired.`, renewUrl || '', footer(brand)]),
});

const subscriptionFailed = ({ brand, businessName, planName, amount, currency, reason, retryUrl }) => ({
  subject: 'Subscription payment failed',
  html: layout(brand, {
    title: 'Payment failed',
    preheader: 'We could not process your subscription payment',
    body: `<p style="margin:0 0 12px 0;">We could not process your subscription payment for <strong>${escapeHtml(businessName)}</strong>.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 4px 0;font-size:13px;color:#991b1b;">Plan</p>
               <p style="margin:0 0 12px 0;font-size:14px;color:#7f1d1d;">${escapeHtml(planName)}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#991b1b;">Amount</p>
               <p style="margin:0 0 12px 0;font-size:14px;color:#7f1d1d;">${escapeHtml(money(amount, currency))}</p>
               ${reason ? `<p style="margin:0 0 4px 0;font-size:13px;color:#991b1b;">Reason</p>
               <p style="margin:0;font-size:14px;color:#7f1d1d;">${escapeHtml(reason)}</p>` : ''}
             </td></tr>
           </table>`,
    cta: retryUrl ? cta(retryUrl, 'Retry payment') : undefined,
  }),
  text: plain([`Subscription payment failed for ${businessName}.`, `Plan: ${planName} · Amount: ${money(amount, currency)}`, reason || '', retryUrl || '', footer(brand)]),
});

const planUpgraded = ({ brand, businessName, oldPlan, newPlan, effectiveAt }) => ({
  subject: `Plan upgraded to ${newPlan}`,
  html: layout(brand, {
    title: 'Plan upgraded',
    preheader: `${businessName} upgraded to ${newPlan}`,
    body: `<p style="margin:0 0 12px 0;"><strong>${escapeHtml(businessName)}</strong> upgraded from <strong>${escapeHtml(oldPlan)}</strong> to <strong>${escapeHtml(newPlan)}</strong>.</p>
           <p style="margin:0;color:#64748b;font-size:13px;">Effective: ${escapeHtml(effectiveAt || new Date().toISOString())}</p>`,
  }),
  text: plain([`${businessName} upgraded ${oldPlan} → ${newPlan}.`, footer(brand)]),
});

const planCancelled = ({ brand, businessName, planName, endsAt }) => ({
  subject: 'Plan cancelled',
  html: layout(brand, {
    title: 'Plan cancelled',
    preheader: `${planName} will end soon`,
    body: `<p style="margin:0 0 12px 0;">The <strong>${escapeHtml(planName)}</strong> plan for <strong>${escapeHtml(businessName)}</strong> has been cancelled.</p>
           <p style="margin:0;color:#64748b;font-size:13px;">Access ends: ${escapeHtml(endsAt || 'end of current period')}</p>`,
  }),
  text: plain([`${planName} for ${businessName} cancelled.`, `Ends: ${endsAt || 'end of period'}`, footer(brand)]),
});

/* ─── PURCHASE ORDERS ─── */

const purchaseOrder = ({ brand, businessName, supplierName, poNumber, items, subtotal, tax, shipping, total, currency, expectedAt, notes, pdfUrl, businessContact }) => ({
  subject: `Purchase Order ${poNumber} from ${businessName}`,
  html: layout(brand, {
    title: `Purchase Order ${poNumber}`,
    preheader: `New purchase order from ${businessName}`,
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(supplierName)},</p>
           <p style="margin:0 0 16px 0;">Please find our purchase order below.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
             <thead>
               <tr style="background:#f8fafc;">
                 <th align="left" style="padding:10px 12px;font-size:12px;color:#64748b;font-weight:600;">Item</th>
                 <th align="right" style="padding:10px 12px;font-size:12px;color:#64748b;font-weight:600;">Qty</th>
                 <th align="right" style="padding:10px 12px;font-size:12px;color:#64748b;font-weight:600;">Unit</th>
                 <th align="right" style="padding:10px 12px;font-size:12px;color:#64748b;font-weight:600;">Subtotal</th>
               </tr>
             </thead>
             <tbody>
               ${(items || []).map((i) => `
               <tr>
                 <td style="padding:10px 12px;font-size:14px;border-top:1px solid #f1f5f9;">${escapeHtml(i.name)}</td>
                 <td align="right" style="padding:10px 12px;font-size:14px;border-top:1px solid #f1f5f9;">${escapeHtml(String(i.qty))}</td>
                 <td align="right" style="padding:10px 12px;font-size:14px;border-top:1px solid #f1f5f9;">${escapeHtml(money(i.unitCost, currency))}</td>
                 <td align="right" style="padding:10px 12px;font-size:14px;border-top:1px solid #f1f5f9;">${escapeHtml(money(i.subtotal, currency))}</td>
               </tr>`).join('')}
             </tbody>
           </table>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:12px;">
             <tr><td align="right" style="font-size:14px;color:#334155;padding:2px 0;">Subtotal: ${escapeHtml(money(subtotal, currency))}</td></tr>
             ${tax ? `<tr><td align="right" style="font-size:14px;color:#334155;padding:2px 0;">Tax: ${escapeHtml(money(tax, currency))}</td></tr>` : ''}
             ${shipping ? `<tr><td align="right" style="font-size:14px;color:#334155;padding:2px 0;">Shipping: ${escapeHtml(money(shipping, currency))}</td></tr>` : ''}
             <tr><td align="right" style="font-size:16px;font-weight:600;color:#0f172a;padding-top:6px;">Total: ${escapeHtml(money(total, currency))}</td></tr>
           </table>
           ${expectedAt ? `<p style="margin:16px 0 0 0;font-size:13px;color:#64748b;">Expected delivery: ${escapeHtml(expectedAt)}</p>` : ''}
           ${notes ? `<p style="margin:8px 0 0 0;font-size:13px;color:#64748b;">Notes: ${escapeHtml(notes)}</p>` : ''}
           ${businessContact ? `<p style="margin:16px 0 0 0;font-size:13px;color:#64748b;">Questions? Contact ${escapeHtml(businessContact.name || businessName)}${businessContact.phone ? ` · ${escapeHtml(businessContact.phone)}` : ''}${businessContact.email ? ` · ${escapeHtml(businessContact.email)}` : ''}</p>` : ''}`,
    cta: pdfUrl ? cta(pdfUrl, 'Download PDF') : undefined,
  }),
  text: plain([
    `Purchase Order ${poNumber} from ${businessName}`,
    '',
    ...(items || []).map((i) => `- ${i.name} x${i.qty} @ ${money(i.unitCost, currency)}`),
    '',
    `Subtotal: ${money(subtotal, currency)}`,
    tax ? `Tax: ${money(tax, currency)}` : '',
    shipping ? `Shipping: ${money(shipping, currency)}` : '',
    `Total: ${money(total, currency)}`,
    expectedAt ? `Expected: ${expectedAt}` : '',
    notes ? `Notes: ${notes}` : '',
    pdfUrl || '',
    footer(brand),
  ]),
});

const purchaseOrderCancelled = ({ brand, businessName, supplierName, poNumber, reason }) => ({
  subject: `Cancelled: Purchase Order ${poNumber}`,
  html: layout(brand, {
    title: `Purchase Order ${poNumber} cancelled`,
    preheader: `${businessName} cancelled PO ${poNumber}`,
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(supplierName)},</p>
           <p style="margin:0 0 12px 0;"><strong>${escapeHtml(businessName)}</strong> has cancelled purchase order <strong>${escapeHtml(poNumber)}</strong>.</p>
           ${reason ? `<p style="margin:0;color:#64748b;font-size:13px;">Reason: ${escapeHtml(reason)}</p>` : ''}`,
  }),
  text: plain([`PO ${poNumber} cancelled by ${businessName}.`, reason || '', footer(brand)]),
});

/* ─── INVOICES ─── */

const invoice = ({
  brand,
  businessName,
  customerName,
  invoiceNumber,
  items,
  subtotal,
  discount,
  tax,
  total,
  amountDue,
  currency,
  dueDate,
  issuedAt,
  notes,
  status,
  instructions,
  payUrl,
  businessContact,
}) => {
  const fmt = (n) => money(n, currency);

  const itemsHtml = (items || [])
    .map(
      (item, i) => `
    <tr>
      <td style="padding:14px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;${i % 2 === 1 ? 'background:#f8fafc;' : ''}">
        <div style="font-weight:500;color:#0f172a;">${escapeHtml(item.name)}</div>
        ${item.description ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px;">${escapeHtml(item.description)}</div>` : ''}
      </td>
      <td style="padding:14px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;color:#334155;${i % 2 === 1 ? 'background:#f8fafc;' : ''}">${item.qty}</td>
      <td style="padding:14px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;color:#334155;${i % 2 === 1 ? 'background:#f8fafc;' : ''}">${fmt(item.unitPrice)}</td>
      <td style="padding:14px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;font-weight:600;color:#0f172a;${i % 2 === 1 ? 'background:#f8fafc;' : ''}">${fmt(item.subtotal)}</td>
    </tr>`
    )
    .join('');

  const instructionsHtml =
    instructions && instructions.length
      ? `
    <tr>
      <td style="padding:0 32px 24px 32px;">
        <div style="padding:20px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;">
          <div style="font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">How to pay</div>
          ${instructions
            .map(
              (method, i) => `
            <div style="margin-bottom:${i < instructions.length - 1 ? '20px' : '0'};padding-bottom:${i < instructions.length - 1 ? '20px' : '0'};${i < instructions.length - 1 ? 'border-bottom:1px dashed #bae6fd;' : ''}">
              <div style="display:inline-block;padding:3px 10px;background:#0369a1;color:#ffffff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-radius:4px;margin-bottom:8px;">
                ${escapeHtml(method.title)}
              </div>
              ${method.description ? `<div style="font-size:12px;color:#0c4a6e;margin-bottom:10px;">${escapeHtml(method.description)}</div>` : ''}
              ${
                method.steps && method.steps.length
                  ? `<ol style="margin:0;padding-left:20px;font-size:13px;color:#0c4a6e;line-height:1.8;">
                  ${method.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
                </ol>`
                  : ''
              }
              ${
                method.action && method.action.type === 'stk' && payUrl
                  ? `<div style="margin-top:12px;padding:12px;background:#ffffff;border:1px solid #bae6fd;border-radius:6px;">
                  <div style="font-size:12px;color:#0369a1;margin-bottom:8px;">Want us to send the payment prompt to your phone?</div>
                  <a href="${payUrl}" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;font-weight:600;font-size:12px;padding:10px 16px;border-radius:6px;">${escapeHtml(method.action.label || 'Pay this invoice')}</a>
                </div>`
                  : ''
              }
              ${
                method.action && method.action.type === 'stripe' && payUrl
                  ? `<div style="margin-top:12px;padding:12px;background:#ffffff;border:1px solid #bae6fd;border-radius:6px;">
                  <a href="${payUrl}" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;font-weight:600;font-size:12px;padding:10px 16px;border-radius:6px;">${escapeHtml(method.action.label || 'Pay with card')}</a>
                </div>`
                  : ''
              }
            </div>`
            )
            .join('')}
        </div>
      </td>
    </tr>`
      : '';

  const invoiceBody = `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <tr>
        <td style="background:${brand.color};padding:28px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">${escapeHtml(businessName)}</div>
                <div style="color:#94a3b8;font-size:12px;margin-top:4px;">Point of Sale Platform</div>
              </td>
              <td style="text-align:right;">
                <div style="color:${brand.accent};font-size:24px;font-weight:700;letter-spacing:2px;">INVOICE</div>
                <div style="color:#94a3b8;font-size:12px;margin-top:4px;">${escapeHtml(invoiceNumber)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:28px 32px 8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-right:24px;">
                <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Billed to</div>
                <div style="font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(customerName)}</div>
              </td>
              <td style="vertical-align:top;text-align:right;">
                <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Invoice details</div>
                <div style="font-size:13px;color:#334155;line-height:1.7;">
                  ${issuedAt ? `<div><strong style="color:#0f172a;">Issued:</strong> ${escapeHtml(issuedAt)}</div>` : ''}
                  ${dueDate ? `<div><strong style="color:#0f172a;">Due:</strong> ${escapeHtml(dueDate)}</div>` : ''}
                  <div><strong style="color:#0f172a;">Currency:</strong> ${escapeHtml(currency)}</div>
                  ${status ? `<div><strong style="color:#0f172a;">Status:</strong> ${escapeHtml(status)}</div>` : ''}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:20px 32px 8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <thead>
              <tr>
                <th style="background:#f1f5f9;padding:12px;text-align:left;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Description</th>
                <th style="background:#f1f5f9;padding:12px;text-align:right;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Qty</th>
                <th style="background:#f1f5f9;padding:12px;text-align:right;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Unit price</th>
                <th style="background:#f1f5f9;padding:12px;text-align:right;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:16px 32px 28px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:320px;margin-left:auto;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#64748b;">Subtotal</td>
              <td style="padding:8px 0;font-size:13px;color:#334155;text-align:right;font-weight:500;">${fmt(subtotal)}</td>
            </tr>
            ${
              discount > 0
                ? `<tr>
              <td style="padding:8px 0;font-size:13px;color:#64748b;">Discount</td>
              <td style="padding:8px 0;font-size:13px;color:#334155;text-align:right;font-weight:500;">-${fmt(discount)}</td>
            </tr>`
                : ''
            }
            ${
              tax > 0
                ? `<tr>
              <td style="padding:8px 0;font-size:13px;color:#64748b;">Tax</td>
              <td style="padding:8px 0;font-size:13px;color:#334155;text-align:right;font-weight:500;">${fmt(tax)}</td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding:14px 0 8px 0;font-size:16px;font-weight:700;color:#0f172a;border-top:2px solid #e2e8f0;">Total</td>
              <td style="padding:14px 0 8px 0;font-size:16px;font-weight:700;color:#0f172a;text-align:right;border-top:2px solid #e2e8f0;">${fmt(total)}</td>
            </tr>
            ${
              amountDue !== undefined
                ? `<tr>
              <td style="padding:8px 0;font-size:15px;font-weight:700;color:${brand.accent};">Amount due</td>
              <td style="padding:8px 0;font-size:15px;font-weight:700;color:${brand.accent};text-align:right;">${fmt(amountDue)}</td>
            </tr>`
                : ''
            }
          </table>
        </td>
      </tr>

      ${
        notes
          ? `<tr>
        <td style="padding:0 32px 24px 32px;">
          <div style="padding:14px 16px;background:#eff6ff;border-left:3px solid ${brand.accent};border-radius:4px;font-size:12px;color:#1e40af;">
            <strong>Notes:</strong> ${escapeHtml(notes)}
          </div>
        </td>
      </tr>`
          : ''
      }

      ${instructionsHtml}

      <tr>
        <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <div style="font-size:12px;color:#64748b;font-weight:500;">Thank you for your business.</div>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Invoice ${invoiceNumber} from ${businessName}`,
    html: layout(brand, {
      title: `Invoice ${invoiceNumber}`,
      preheader: `Invoice from ${businessName} — ${fmt(amountDue || total)} due`,
      body: invoiceBody,
    }),
    text: plain([
      `INVOICE ${invoiceNumber}`,
      `From: ${businessName}`,
      `To: ${customerName}`,
      '',
      ...(items || []).map(
        (item) => `- ${item.name} x${item.qty} @ ${fmt(item.unitPrice)} = ${fmt(item.subtotal)}`
      ),
      '',
      `Subtotal: ${fmt(subtotal)}`,
      discount > 0 ? `Discount: -${fmt(discount)}` : '',
      tax > 0 ? `Tax: ${fmt(tax)}` : '',
      `Total: ${fmt(total)}`,
      amountDue !== undefined ? `Amount due: ${fmt(amountDue)}` : '',
      '',
      dueDate ? `Due date: ${dueDate}` : '',
      notes || '',
      '',
      ...(instructions || []).flatMap((m) => [
        `${m.title}:`,
        ...(m.steps || []).map((s) => `  - ${s}`),
        '',
      ]),
      payUrl ? `Pay online: ${payUrl}` : '',
      footer(brand),
    ]),
  };
};

const invoiceReminder = ({ brand, businessName, customerName, invoiceNumber, total, currency, dueDate, daysOverdue, paymentLink }) => ({
  subject: `Reminder: Invoice ${invoiceNumber} is unpaid`,
  html: layout(brand, {
    title: 'Friendly reminder',
    preheader: `Invoice ${invoiceNumber} is awaiting payment`,
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(customerName)},</p>
           <p style="margin:0 0 12px 0;">This is a reminder that invoice <strong>${escapeHtml(invoiceNumber)}</strong> from <strong>${escapeHtml(businessName)}</strong> is unpaid.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 4px 0;font-size:13px;color:#92400e;">Amount due</p>
               <p style="margin:0 0 12px 0;font-size:18px;font-weight:600;color:#78350f;">${escapeHtml(money(total, currency))}</p>
               ${dueDate ? `<p style="margin:0;font-size:13px;color:#92400e;">Due: ${escapeHtml(dueDate)}${daysOverdue ? ` · ${escapeHtml(String(daysOverdue))} days overdue` : ''}</p>` : ''}
             </td></tr>
           </table>`,
    cta: paymentLink ? cta(paymentLink, 'Pay now') : undefined,
  }),
  text: plain([`Reminder: Invoice ${invoiceNumber} from ${businessName} is unpaid.`, `Amount due: ${money(total, currency)}`, dueDate ? `Due: ${dueDate}` : '', paymentLink || '', footer(brand)]),
});

const invoicePaid = ({
  brand,
  businessName,
  customerName,
  invoiceNumber,
  amount,
  currency,
  paidAt,
  paymentMethod,
  paymentReference,
  receiptUrl,
}) => ({
  subject: `Payment received — ${invoiceNumber}`,
  html: layout(brand, {
    title: 'Payment received',
    preheader: `Payment of ${money(amount, currency)} confirmed`,
    body: `
      <p style="margin:0 0 12px 0;">Hi ${escapeHtml(customerName)},</p>

      <p style="margin:0 0 16px 0;">
        Payment for <strong>${escapeHtml(invoiceNumber)}</strong> has been received. Thank you!
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 4px 0;font-size:13px;color:#166534;">Amount paid</p>
          <p style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#14532d;">${escapeHtml(money(amount, currency))}</p>

          ${paymentMethod ? `<p style="margin:0 0 4px 0;font-size:13px;color:#166534;">Method</p>
            <p style="margin:0 0 12px 0;font-size:14px;color:#14532d;">${escapeHtml(methodLabel(paymentMethod))}</p>` : ''}

          ${paymentReference ? `<p style="margin:0 0 4px 0;font-size:13px;color:#166534;">Reference</p>
            <p style="margin:0 0 12px 0;font-size:14px;color:#14532d;font-family:monospace;">${escapeHtml(paymentReference)}</p>` : ''}

          <p style="margin:0 0 4px 0;font-size:13px;color:#166534;">Date</p>
          <p style="margin:0;font-size:14px;color:#14532d;">${escapeHtml(humanDate(paidAt))}</p>
        </td></tr>
      </table>

      <p style="margin:16px 0 0 0;">
        We'll process your account and you'll receive another email once it's ready.
      </p>
    `,
    cta: receiptUrl ? cta(receiptUrl, 'View receipt') : undefined,
  }),
  text: plain([
    `Hi ${customerName},`,
    '',
    `Payment for ${invoiceNumber} has been received. Thank you!`,
    '',
    `Amount: ${money(amount, currency)}`,
    paymentMethod ? `Method: ${methodLabel(paymentMethod)}` : '',
    paymentReference ? `Reference: ${paymentReference}` : '',
    `Date: ${humanDate(paidAt)}`,
    '',
    "We'll process your account and you'll receive another email once it's ready.",
    receiptUrl || '',
    footer(brand),
  ]),
});

const paymentReceived = ({
  brand,
  businessName,
  customerName,
  invoiceNumber,
  amount,
  currency,
  paidAt,
  paymentMethod,
  paymentReference,
  notes,
}) => ({
  subject: `Payment received — ${invoiceNumber}`,
  html: layout(brand, {
    title: 'Payment received',
    preheader: `We've confirmed your payment of ${money(amount, currency)}`,
    body: `
      <p style="margin:0 0 12px 0;">Hi ${escapeHtml(customerName)},</p>

      <p style="margin:0 0 16px 0;">
        We've confirmed receipt of your payment for <strong>${escapeHtml(invoiceNumber)}</strong>.
        Thank you!
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 4px 0;font-size:13px;color:#166534;">Amount</p>
          <p style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#14532d;">${escapeHtml(money(amount, currency))}</p>

          ${paymentMethod ? `<p style="margin:0 0 4px 0;font-size:13px;color:#166534;">Method</p>
            <p style="margin:0 0 12px 0;font-size:14px;color:#14532d;">${escapeHtml(methodLabel(paymentMethod))}</p>` : ''}

          ${paymentReference ? `<p style="margin:0 0 4px 0;font-size:13px;color:#166534;">Reference</p>
            <p style="margin:0 0 12px 0;font-size:14px;color:#14532d;font-family:monospace;">${escapeHtml(paymentReference)}</p>` : ''}

          <p style="margin:0 0 4px 0;font-size:13px;color:#166534;">Date</p>
          <p style="margin:0;font-size:14px;color:#14532d;">${escapeHtml(humanDate(paidAt))}</p>
        </td></tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">Next step</p>
          <p style="margin:0;font-size:14px;color:#78350f;">
            Your account is still under review by the ${escapeHtml(brand.name)} team.
            We'll notify you by email as soon as it's approved.
          </p>
        </td></tr>
      </table>

      ${notes ? `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:14px 16px;">
          <p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Note from our team</p>
          <p style="margin:0;font-size:13px;color:#334155;">${escapeHtml(notes)}</p>
        </td></tr>
      </table>
      ` : ''}

      <p style="margin:16px 0 0 0;">
        Questions? Reply to this email or reach us at
        <a href="mailto:${brand.supportEmail}" style="color:${brand.accent};text-decoration:none;">${escapeHtml(brand.supportEmail)}</a>.
      </p>

      <p style="margin:16px 0 0 0;">— The ${escapeHtml(brand.name)} Team</p>
    `,
  }),
  text: plain([
    `Hi ${customerName},`,
    '',
    `We've confirmed receipt of your payment for ${invoiceNumber}. Thank you!`,
    '',
    `Amount: ${money(amount, currency)}`,
    paymentMethod ? `Method: ${methodLabel(paymentMethod)}` : '',
    paymentReference ? `Reference: ${paymentReference}` : '',
    `Date: ${humanDate(paidAt)}`,
    '',
    'NEXT STEP',
    `Your account is still under review by the ${brand.name} team. We'll notify you by email as soon as it's approved.`,
    notes ? `\nNote from our team: ${notes}` : '',
    '',
    `Questions? Contact ${brand.supportEmail}.`,
    '',
    `— The ${brand.name} Team`,
    footer(brand),
  ]),
});

const invoiceOverdue = ({ brand, businessName, customerName, invoiceNumber, total, currency, daysOverdue, paymentLink }) => ({
  subject: `Overdue: Invoice ${invoiceNumber} — ${daysOverdue} days`,
  html: layout(brand, {
    title: 'Invoice overdue',
    preheader: `Invoice ${invoiceNumber} is overdue`,
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(customerName)},</p>
           <p style="margin:0 0 12px 0;">Invoice <strong>${escapeHtml(invoiceNumber)}</strong> from <strong>${escapeHtml(businessName)}</strong> is now <strong>${escapeHtml(String(daysOverdue))}</strong> days overdue.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 4px 0;font-size:13px;color:#991b1b;">Amount due</p>
               <p style="margin:0;font-size:18px;font-weight:600;color:#7f1d1d;">${escapeHtml(money(total, currency))}</p>
             </td></tr>
           </table>
           <p style="margin:16px 0 0 0;">Please settle this payment as soon as possible.</p>`,
    cta: paymentLink ? cta(paymentLink, 'Pay now') : undefined,
  }),
  text: plain([`Invoice ${invoiceNumber} is ${daysOverdue} days overdue.`, `Amount due: ${money(total, currency)}`, paymentLink || '', footer(brand)]),
});

const invoiceCancelled = ({ brand, businessName, customerName, invoiceNumber, reason }) => ({
  subject: `Cancelled: Invoice ${invoiceNumber}`,
  html: layout(brand, {
    title: `Invoice ${invoiceNumber} cancelled`,
    preheader: `${businessName} cancelled invoice ${invoiceNumber}`,
    body: `<p style="margin:0 0 12px 0;">Hi ${escapeHtml(customerName)},</p>
           <p style="margin:0 0 12px 0;"><strong>${escapeHtml(businessName)}</strong> has cancelled invoice <strong>${escapeHtml(invoiceNumber)}</strong>.</p>
           ${reason ? `<p style="margin:0;color:#64748b;font-size:13px;">Reason: ${escapeHtml(reason)}</p>` : ''}`,
  }),
  text: plain([`Invoice ${invoiceNumber} cancelled by ${businessName}.`, reason || '', footer(brand)]),
});

/* ─── ADMIN NOTIFICATIONS ─── */

const adminNewPending = ({ brand, businessName, ownerName, ownerEmail, ownerPhone, country, businessType, registeredAt, reviewUrl }) => ({
  subject: `New registration pending — ${businessName}`,
  html: layout(brand, {
    title: 'New pending registration',
    preheader: `${businessName} is waiting for approval`,
    body: `<p style="margin:0 0 16px 0;">A new business registered and is waiting for approval.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Business</p>
               <p style="margin:0 0 12px 0;font-size:15px;font-weight:600;">${escapeHtml(businessName)}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Owner</p>
               <p style="margin:0 0 12px 0;font-size:14px;">${escapeHtml(ownerName)} · ${escapeHtml(ownerEmail)}${ownerPhone ? ` · ${escapeHtml(ownerPhone)}` : ''}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Country / Type</p>
               <p style="margin:0 0 12px 0;font-size:14px;">${escapeHtml(country)} · ${escapeHtml(businessType)}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Registered</p>
               <p style="margin:0;font-size:14px;">${escapeHtml(registeredAt)}</p>
             </td></tr>
           </table>`,
    cta: cta(reviewUrl, 'Review registration'),
  }),
  text: plain([
    `New pending registration: ${businessName}`,
    `Owner: ${ownerName} (${ownerEmail}${ownerPhone ? `, ${ownerPhone}` : ''})`,
    `Country / Type: ${country} / ${businessType}`,
    `Registered: ${registeredAt}`,
    '',
    `Review: ${reviewUrl}`,
    footer(brand),
  ]),
});

const adminPendingDigest = ({ brand, count, items, reviewUrl }) => ({
  subject: `${count} registration${count === 1 ? '' : 's'} pending approval`,
  html: layout(brand, {
    title: 'Pending approvals digest',
    preheader: `${count} registration${count === 1 ? '' : 's'} waiting`,
    body: `<p style="margin:0 0 16px 0;">${count} registration${count === 1 ? '' : 's'} pending approval.</p>
           <ul style="margin:0 0 8px 0;padding-left:20px;font-size:14px;color:#334155;">
             ${(items || []).map((i) => `<li style="margin-bottom:6px;"><strong>${escapeHtml(i.businessName)}</strong> — ${escapeHtml(i.ownerEmail)}</li>`).join('')}
           </ul>`,
    cta: cta(reviewUrl, 'Review all'),
  }),
  text: plain([
    `${count} registration(s) pending:`,
    ...(items || []).map((i) => `- ${i.businessName} (${i.ownerEmail})`),
    '',
    `Review: ${reviewUrl}`,
    footer(brand),
  ]),
});

const adminServiceDown = ({ brand, service, error, since }) => ({
  subject: `Alert: ${service} is down`,
  html: layout(brand, {
    title: `Service alert — ${service}`,
    preheader: `${service} health check failed`,
    body: `<p style="margin:0 0 12px 0;">The health check for <strong>${escapeHtml(service)}</strong> failed.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 4px 0;font-size:13px;color:#991b1b;">Error</p>
               <p style="margin:0 0 12px 0;font-size:14px;color:#7f1d1d;">${escapeHtml(error || 'Unknown')}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#991b1b;">Since</p>
               <p style="margin:0;font-size:14px;color:#7f1d1d;">${escapeHtml(since || new Date().toISOString())}</p>
             </td></tr>
           </table>`,
  }),
  text: plain([
    `${service} is down.`,
    `Error: ${error || 'Unknown'}`,
    `Since: ${since || new Date().toISOString()}`,
    footer(brand),
  ]),
});

const adminBackupFailed = ({ brand, error, at }) => ({
  subject: 'Backup failed',
  html: layout(brand, {
    title: 'Backup failed',
    preheader: 'Automatic backup did not complete',
    body: `<p style="margin:0 0 12px 0;">Automatic backup failed.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 4px 0;font-size:13px;color:#991b1b;">Error</p>
               <p style="margin:0 0 12px 0;font-size:14px;color:#7f1d1d;">${escapeHtml(error || 'Unknown')}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#991b1b;">When</p>
               <p style="margin:0;font-size:14px;color:#7f1d1d;">${escapeHtml(at || new Date().toISOString())}</p>
             </td></tr>
           </table>`,
  }),
  text: plain(['Backup failed.', `Error: ${error || 'Unknown'}`, `At: ${at || new Date().toISOString()}`, footer(brand)]),
});

const adminRestoreComplete = ({ brand, filename, collections, at }) => ({
  subject: 'Backup restore completed',
  html: layout(brand, {
    title: 'Restore completed',
    preheader: `Restore of ${filename} finished`,
    body: `<p style="margin:0 0 12px 0;">Restore from <strong>${escapeHtml(filename)}</strong> completed.</p>
           <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
             <tr><td style="padding:16px;">
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Collections</p>
               <p style="margin:0 0 12px 0;font-size:14px;">${escapeHtml((collections || []).join(', '))}</p>
               <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">When</p>
               <p style="margin:0;font-size:14px;">${escapeHtml(at || new Date().toISOString())}</p>
             </td></tr>
           </table>`,
  }),
  text: plain([`Restore from ${filename} completed.`, `Collections: ${(collections || []).join(', ')}`, `At: ${at || new Date().toISOString()}`, footer(brand)]),
});

module.exports = {
  emailTemplates: {
    verification,
    passwordReset,
    passwordChanged,
    registrationReceived,
    welcome,
    rejection,
    pendingReminder,
    pendingExpired,
    staffWelcome,
    staffDeactivated,
    roleChanged,
    lowStockAlert,
    outOfStock,
    dailySummary,
    weeklyReport,
    subscriptionPaid,
    subscriptionExpiring,
    subscriptionExpired,
    subscriptionFailed,
    planUpgraded,
    planCancelled,
    purchaseOrder,
    purchaseOrderCancelled,
    invoice,
    invoiceReminder,
    invoicePaid,
    paymentReceived,
    invoiceOverdue,
    invoiceCancelled,
    adminNewPending,
    adminPendingDigest,
    adminServiceDown,
    adminBackupFailed,
    adminRestoreComplete,
  },
};