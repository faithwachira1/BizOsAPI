require('dotenv/config');
const readline = require('readline');

const { connectDB, disconnectDB, mongoose } = require('../config/db');
const Plan = require('../models/admin/Plan');
const PaymentMethod = require('../models/admin/PaymentMethod');
const PlatformSetting = require('../models/admin/PlatformSetting');
const Legal = require('../models/admin/Legal');

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

function clear() {
  process.stdout.write('\x1b[2J\x1b[0f');
}

function line(str = '') {
  console.log(str);
}

function heading(title) {
  line();
  line(`${C.bold}${C.cyan}${title}${C.reset}`);
  line(`${C.dim}${'─'.repeat(title.length)}${C.reset}`);
  line();
}

function ok(msg) {
  line(`${C.green}✔${C.reset} ${msg}`);
}

function warn(msg) {
  line(`${C.yellow}⚠${C.reset} ${msg}`);
}

function err(msg) {
  line(`${C.red}✖${C.reset} ${msg}`);
}

/* ─────────────────────── PLANS ─────────────────────── */

async function seedPlans() {
  const plans = [
    {
      code: 'standard',
      name: 'Standard',
      description: 'One-time payment. Full access. No expiry.',
      price: { amount: 6000, currency: 'KES', interval: 'once' },
      limits: {
        maxOwners: 10,
        maxManagers: 50,
        maxCashiers: 999,
        maxProducts: 999999,
        maxTransactionsPerMonth: 0,
        maxAiCallsPerDay: 9999,
      },
      features: {
        aiInsights: true,
        multiLocation: true,
        api: true,
        prioritySupport: true,
        customDomain: true,
      },
      isPublic: true,
      isActive: true,
      sortOrder: 0,
      trialDays: 0,
    },
    {
      code: 'starter',
      name: 'Starter',
      description: 'For growing businesses',
      price: { amount: 1500, currency: 'KES', interval: 'month' },
      limits: {
        maxOwners: 2,
        maxManagers: 5,
        maxCashiers: 10,
        maxProducts: 1000,
        maxTransactionsPerMonth: 10000,
        maxAiCallsPerDay: 50,
      },
      features: {
        aiInsights: true,
        multiLocation: false,
        api: false,
        prioritySupport: false,
        customDomain: false,
      },
      isPublic: true,
      isActive: false,
      sortOrder: 1,
      trialDays: 14,
    },
    {
      code: 'pro',
      name: 'Pro',
      description: 'Full power for multi-location',
      price: { amount: 4500, currency: 'KES', interval: 'month' },
      limits: {
        maxOwners: 5,
        maxManagers: 20,
        maxCashiers: 100,
        maxProducts: 10000,
        maxTransactionsPerMonth: 100000,
        maxAiCallsPerDay: 500,
      },
      features: {
        aiInsights: true,
        multiLocation: true,
        api: true,
        prioritySupport: true,
        customDomain: false,
      },
      isPublic: true,
      isActive: false,
      sortOrder: 2,
      trialDays: 14,
    },
  ];

  let upserted = 0;
  for (const plan of plans) {
    await Plan.updateOne({ code: plan.code }, { $setOnInsert: plan }, { upsert: true });
    upserted++;
  }
  ok(`Plans: ${upserted} upserted`);
}

/* ─────────────────────── PAYMENT METHODS ─────────────────────── */

async function seedPaymentMethods() {
  const methods = [
    {
      code: 'stripe',
      label: 'Card (Stripe)',
      mode: 'auto',
      enabled: false,
      order: 1,
      config: { publishableKey: '', secretKey: '', webhookSecret: '', mode: 'test' },
    },
    {
      code: 'mpesa_stk',
      label: 'M-Pesa STK',
      mode: 'auto',
      enabled: false,
      order: 2,
      config: { env: 'sandbox', consumerKey: '', consumerSecret: '', shortcode: '', passkey: '', callbackUrl: '' },
    },
    {
      code: 'cash',
      label: 'Cash',
      mode: 'manual',
      enabled: true,
      order: 3,
      config: {},
    },
    {
      code: 'mpesa_send',
      label: 'M-Pesa Send Money',
      mode: 'manual',
      enabled: false,
      order: 4,
      config: { phone: '', name: '' },
    },
    {
      code: 'mpesa_till',
      label: 'M-Pesa Till',
      mode: 'manual',
      enabled: false,
      order: 5,
      config: { tillNumber: '', name: '' },
    },
    {
      code: 'mpesa_paybill',
      label: 'M-Pesa Paybill',
      mode: 'manual',
      enabled: false,
      order: 6,
      config: { paybillNumber: '', accountNumber: '', name: '' },
    },
    {
      code: 'bank',
      label: 'Bank Transfer',
      mode: 'manual',
      enabled: false,
      order: 7,
      config: { bankName: '', accountName: '', accountNumber: '', branch: '', swift: '' },
    },
  ];

  let upserted = 0;
  for (const m of methods) {
    await PaymentMethod.updateOne({ code: m.code }, { $setOnInsert: m }, { upsert: true });
    upserted++;
  }
  ok(`Payment methods: ${upserted} upserted`);
}

/* ─────────────────────── PLATFORM SETTINGS ─────────────────────── */

async function seedSettings() {
  const settings = [
    ['platform_name', 'BizOS'],
    ['platform_logo_url', null],
    ['support_email', 'support@bizos.co.ke'],
    ['support_phone', '+254 700 000 000'],
    ['platform_website', 'https://bizos.co.ke'],
    ['default_currency', 'KES'],
    ['default_country', 'KE'],
    ['default_tax_rate', 16],
    ['tax_inclusive', false],
    ['min_password_length', 8],
    ['registration_open', true],
    ['maintenance_mode', false],
    ['max_owners_per_tenant', 3],
    ['cashier_discount_limit', 10],
    ['cashier_refund_limit', 0],
    ['manager_can_invite_cashier', false],
    ['require_shift_clock_in', false],
    ['backup_auto_enabled', true],
    ['backup_frequency', 'daily'],
    ['backup_time', '03:00'],
    ['backup_retention_days', 90],
    ['backup_notify_on_fail', true],
    ['backup_notify_emails', []],
    ['feature_pos', true],
    ['feature_inventory', true],
    ['feature_ai_insights', true],
    ['feature_multi_location', false],
    ['feature_loyalty', false],
    ['feature_storefront', false],
    ['feature_accounting', false],
    ['feature_api', false],
    ['feature_purchase_orders', true],
    ['feature_invoices', true],
    ['business_types', ['retail', 'restaurant', 'salon', 'pharmacy', 'cosmetics', 'other']],
    ['countries', [
      { code: 'KE', name: 'Kenya', currency: 'KES', dialCode: '+254' },
      { code: 'UG', name: 'Uganda', currency: 'UGX', dialCode: '+256' },
      { code: 'TZ', name: 'Tanzania', currency: 'TZS', dialCode: '+255' },
      { code: 'NG', name: 'Nigeria', currency: 'NGN', dialCode: '+234' },
      { code: 'GH', name: 'Ghana', currency: 'GHS', dialCode: '+233' },
      { code: 'ZA', name: 'South Africa', currency: 'ZAR', dialCode: '+27' },
    ]],
    ['currencies', ['KES', 'UGX', 'TZS', 'NGN', 'GHS', 'ZAR', 'USD']],
    ['chat_greeting', 'Hi! Ask me anything about BizOS.'],
    ['chat_disclaimer', 'I only know what BizOS can do. For anything else, email support@bizos.co.ke.'],
    ['downloads', [
      {
        id: 'seed-product-import',
        name: 'Product Import Template',
        version: '1.0',
        link: '/downloads/product-import-template.csv',
        platform: 'template',
        description: 'CSV template for bulk importing products.',
        isActive: true,
        sortOrder: 1,
      },
      {
        id: 'seed-customer-import',
        name: 'Customer Import Template',
        version: '1.0',
        link: '/downloads/customer-import-template.csv',
        platform: 'template',
        description: 'CSV template for bulk importing customers.',
        isActive: true,
        sortOrder: 2,
      },
      {
        id: 'seed-invoice-template',
        name: 'Invoice Template',
        version: '1.0',
        link: '/downloads/invoice-template.pdf',
        platform: 'template',
        description: 'PDF invoice template you can customize.',
        isActive: true,
        sortOrder: 3,
      },
      {
        id: 'seed-receipt-template',
        name: 'Receipt Template',
        version: '1.0',
        link: '/downloads/receipt-template.pdf',
        platform: 'template',
        description: 'PDF receipt template for printed receipts.',
        isActive: true,
        sortOrder: 4,
      },
    ]],
  ];

  let upserted = 0;
  for (const [key, value] of settings) {
    await PlatformSetting.updateOne({ key }, { $setOnInsert: { key, value } }, { upsert: true });
    upserted++;
  }
  ok(`Platform settings: ${upserted} upserted`);
}

/* ─────────────────────── LEGAL ─────────────────────── */

async function seedLegals() {
  const terms = `# Terms of Service

By using BizOS you agree to these terms.

## 1. Account

You are responsible for your account and any activity under it.

## 2. Payments

Subscription fees are billed as agreed at signup.

## 3. Data

You retain ownership of your business data. We store and process it to provide the service.

## 4. Termination

You may cancel at any time. We may suspend accounts that violate these terms.

## 5. Contact

For questions contact support@bizos.co.ke.
`;

  const privacy = `# Privacy Policy

We collect the minimum data needed to run BizOS.

## What we collect

- Business name, owner name, email, phone
- Transaction data you enter
- Usage logs

## How we use it

- To operate your account
- To send transactional emails and SMS
- To provide AI insights for your business

## What we don't do

- Sell your data
- Share with third parties except service providers (email, SMS, storage, payments)

## Contact

support@bizos.co.ke
`;

  const dpa = `# Data Processing Agreement

This DPA governs processing of personal data under BizOS.

## Roles

BizOS is the data processor. You are the data controller.

## Sub-processors

- HDM Bridge (email)
- Brevo (SMS)
- Cloudinary (file storage)
- HDM AI (insights)

## Security

Data is stored on encrypted infrastructure. Access is restricted to authorized personnel.

## Contact

support@bizos.co.ke
`;

  const refund = `# Refund Policy

Subscription fees are non-refundable once a billing period has started.

If you were charged in error, contact support within 7 days.

support@bizos.co.ke
`;

  const aup = `# Acceptable Use Policy

Do not use BizOS to:

- Break any law
- Process illegal goods or services
- Send spam through email or SMS features
- Attempt to access other tenants' data

Violation may lead to suspension or termination.
`;

  const docs = [
    { type: 'terms', title: 'Terms of Service', content: terms },
    { type: 'privacy', title: 'Privacy Policy', content: privacy },
    { type: 'dpa', title: 'Data Processing Agreement', content: dpa },
    { type: 'refund', title: 'Refund Policy', content: refund },
    { type: 'aup', title: 'Acceptable Use Policy', content: aup },
  ];

  let inserted = 0;
  for (const d of docs) {
    const existing = await Legal.findOne({ type: d.type }).lean();
    if (existing) continue;

    await Legal.create({
      type: d.type,
      version: 1,
      title: d.title,
      content: d.content,
      effectiveAt: new Date(),
      publishedAt: new Date(),
      isCurrent: true,
    });
    inserted++;
  }
  ok(`Legal docs: ${inserted} inserted`);
}

/* ─────────────────────── MENU ─────────────────────── */

async function menu() {
  clear();
  line();
  line(`${C.bold}${C.cyan}╭─────────────────────────────────────╮${C.reset}`);
  line(`${C.bold}${C.cyan}│   BizOS — Seed CLI                  │${C.reset}`);
  line(`${C.bold}${C.cyan}╰─────────────────────────────────────╯${C.reset}`);
  line();
  line(`  ${C.bold}1${C.reset}.  Seed all`);
  line(`  ${C.bold}2${C.reset}.  Seed platform settings`);
  line(`  ${C.bold}3${C.reset}.  Seed plans`);
  line(`  ${C.bold}4${C.reset}.  Seed payment methods`);
  line(`  ${C.bold}5${C.reset}.  Seed legal docs`);
  line();
  line(`  ${C.dim}0.  Exit${C.reset}`);
  line();

  return await ask(`${C.cyan}›${C.reset} Select option: `);
}

async function main() {
  clear();
  line(`${C.dim}Connecting to MongoDB...${C.reset}`);

  try {
    await connectDB();
    ok('Connected');
  } catch (e) {
    err(`Connection failed: ${e.message}`);
    process.exit(1);
  }

  while (true) {
    const choice = await menu();

    try {
      heading('Seeding');

      if (choice === '1') {
        await seedPlans();
        await seedPaymentMethods();
        await seedSettings();
        await seedLegals();
        line();
        ok('All seeds complete');
      } else if (choice === '2') {
        await seedSettings();
      } else if (choice === '3') {
        await seedPlans();
      } else if (choice === '4') {
        await seedPaymentMethods();
      } else if (choice === '5') {
        await seedLegals();
      } else if (choice === '0') {
        break;
      } else {
        continue;
      }
    } catch (e) {
      err(e.message);
    }

    await ask(`${C.dim}Press Enter to continue...${C.reset}`);
  }

  rl.close();
  await disconnectDB();
  line();
  ok('Bye');
  process.exit(0);
}

main();