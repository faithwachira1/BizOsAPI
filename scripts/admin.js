require('./dnsSet');
require('dotenv/config');
const readline = require('readline');
const crypto = require('crypto');
const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/db');
const SuperAdmin = require('../models/admin/SuperAdmin');
const { hashPassword } = require('../utils/jwt');
const emailService = require('../services/emailService');
const { env } = require('../config/env');

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(question);

    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let input = '';
    const onData = (char) => {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        if (stdin.isTTY) stdin.setRawMode(wasRaw);
        stdin.removeListener('data', onData);
        stdin.pause();
        stdout.write('\n');
        resolve(input.trim());
      } else if (char === '\u0003') {
        stdout.write('\n');
        process.exit(0);
      } else if (char === '\u007F' || char === '\b') {
        input = input.slice(0, -1);
      } else {
        input += char;
      }
    };
    stdin.on('data', onData);
  });
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

function info(msg) {
  line(`${C.dim}·${C.reset} ${msg}`);
}

function randomPassword(len = 14) {
  return crypto.randomBytes(len).toString('base64url').slice(0, len);
}

function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return '[redacted]';
  return `${user.slice(0, 1)}***@${domain}`;
}

async function menu() {
  clear();
  line();
  line(`${C.bold}${C.cyan}╭─────────────────────────────────────╮${C.reset}`);
  line(`${C.bold}${C.cyan}│   BizOS — Admin CLI                 │${C.reset}`);
  line(`${C.bold}${C.cyan}╰─────────────────────────────────────╯${C.reset}`);
  line();
  line(`  ${C.bold}1${C.reset}.  List super admins`);
  line(`  ${C.bold}2${C.reset}.  Create super admin`);
  line(`  ${C.bold}3${C.reset}.  Manage super admin`);
  line(`  ${C.bold}4${C.reset}.  List database collections`);
  line(`  ${C.bold}5${C.reset}.  Drop a collection`);
  line(`  ${C.bold}6${C.reset}.  Drop entire database`);
  line();
  line(`  ${C.dim}0.  Exit${C.reset}`);
  line();

  const choice = await ask(`${C.cyan}›${C.reset} Select option: `);
  return choice;
}

async function listSuperAdmins() {
  heading('Super admins');
  const admins = await SuperAdmin.find().sort({ createdAt: 1 }).lean();

  if (!admins.length) {
    warn('No super admins found');
  } else {
    admins.forEach((a, i) => {
      line(`  ${C.bold}${i + 1}.${C.reset} ${a.fullName} ${C.dim}<${maskEmail(a.email)}>${C.reset}`);
      line(`     ${C.dim}id:${C.reset}     ${a._id}`);
      line(`     ${C.dim}status:${C.reset} ${a.status}`);
      line(`     ${C.dim}role:${C.reset}   ${a.role}`);
      line(`     ${C.dim}last:${C.reset}   ${a.lastLoginAt ? a.lastLoginAt.toISOString() : 'never'}`);
      line();
    });
  }
  await ask(`${C.dim}Press Enter to continue...${C.reset}`);
}

async function createSuperAdmin() {
  heading('Create super admin');

  const fullName = await ask('Full name: ');
  const email = (await ask('Email: ')).toLowerCase();
  const passwordInput = await askHidden('Password (leave blank to generate): ');

  if (!fullName || !email) {
    err('Name and email are required');
    await ask(`${C.dim}Press Enter to continue...${C.reset}`);
    return;
  }

  const existing = await SuperAdmin.findOne({ email });
  if (existing) {
    err(`Email ${email} already exists`);
    await ask(`${C.dim}Press Enter to continue...${C.reset}`);
    return;
  }

  const password = passwordInput || randomPassword(14);
  const passwordHash = await hashPassword(password);

  const admin = await SuperAdmin.create({
    email,
    fullName,
    passwordHash,
    role: 'super_admin',
    status: 'active',
  });

  ok(`Created super admin ${admin.fullName} <${admin.email}>`);

  if (!passwordInput) {
    line();
    line(`  ${C.bold}Temporary password:${C.reset} ${C.yellow}${password}${C.reset}`);
    line(`  ${C.dim}Store this securely — it will not be shown again.${C.reset}`);
    line();
  }

  line(`${C.dim}Sending welcome email...${C.reset}`);
  try {
    await emailService.sendMail({
      to: admin.email,
      subject: `You have been added as a BizOS Super Admin`,
      html: `
        <p>Hi ${admin.fullName},</p>
        <p>Your BizOS super admin account has been created.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0;">
          <tr><td style="padding:16px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Login email</p>
            <p style="margin:0 0 12px 0;font-size:14px;"><strong>${admin.email}</strong></p>
            <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;">Temporary password</p>
            <p style="margin:0;font-size:14px;"><strong>${password}</strong></p>
          </td></tr>
        </table>
        <p>Log in and change your password immediately.</p>
        <p><a href="${env.adminUrl}/login">Open admin panel</a></p>
      `,
      text: `Hi ${admin.fullName},\n\nYour BizOS super admin account was created.\nEmail: ${admin.email}\nPassword: ${password}\n\nLog in: ${env.adminUrl}/login`,
    });
    ok(`Welcome email sent to ${maskEmail(admin.email)}`);
  } catch (e) {
    warn(`Welcome email failed: ${e.message}`);
  }

  await ask(`${C.dim}Press Enter to continue...${C.reset}`);
}

async function manageSuperAdmin() {
  heading('Manage super admins');
  const admins = await SuperAdmin.find().sort({ createdAt: 1 }).lean();

  if (!admins.length) {
    warn('No super admins found');
    await ask(`${C.dim}Press Enter to continue...${C.reset}`);
    return;
  }

  admins.forEach((a, i) => {
    line(`  ${C.bold}${i + 1}.${C.reset} ${a.fullName} ${C.dim}<${maskEmail(a.email)}>${C.reset} — ${a.status}`);
  });
  line();
  line(`  ${C.dim}0.  Back${C.reset}`);
  line();

  const choice = await ask(`${C.cyan}›${C.reset} Select admin: `);
  const index = parseInt(choice, 10) - 1;

  if (isNaN(index) || index < 0 || index >= admins.length) return;

  const admin = admins[index];
  clear();
  heading(`Manage: ${admin.fullName}`);

  line(`  ${C.bold}1${C.reset}.  Reset password`);
  line(`  ${C.bold}2${C.reset}.  Activate`);
  line(`  ${C.bold}3${C.reset}.  Suspend`);
  line(`  ${C.bold}4${C.reset}.  Delete`);
  line();
  line(`  ${C.dim}0.  Back${C.reset}`);
  line();

  const action = await ask(`${C.cyan}›${C.reset} Action: `);

  if (action === '1') {
    const newPassword = await askHidden('New password (leave blank to generate): ');
    const password = newPassword || randomPassword(14);
    admin.passwordHash = await hashPassword(password);

    await SuperAdmin.updateOne(
      { _id: admin._id },
      { $set: { passwordHash: admin.passwordHash } }
    );

    ok(`Password reset for ${admin.email}`);
    if (!newPassword) {
      line();
      line(`  ${C.bold}New password:${C.reset} ${C.yellow}${password}${C.reset}`);
      line();
    }

    try {
      await emailService.sendMail({
        to: admin.email,
        subject: 'Your BizOS admin password was reset',
        html: `<p>Hi ${admin.fullName},</p><p>Your admin password was reset by the platform operator.</p>${!newPassword ? `<p><strong>New password:</strong> ${password}</p>` : ''}<p>Change it after your next login.</p>`,
        text: `Hi ${admin.fullName}, your BizOS admin password was reset.${!newPassword ? ` New password: ${password}` : ''}`,
      });
      ok('Notification email sent');
    } catch (e) {
      warn(`Email failed: ${e.message}`);
    }
  } else if (action === '2') {
    await SuperAdmin.updateOne({ _id: admin._id }, { $set: { status: 'active' } });
    ok(`${admin.email} activated`);
  } else if (action === '3') {
    await SuperAdmin.updateOne({ _id: admin._id }, { $set: { status: 'suspended' } });
    ok(`${admin.email} suspended`);
  } else if (action === '4') {
    const confirm = await ask(`${C.red}Type DELETE to confirm:${C.reset} `);
    if (confirm === 'DELETE') {
      const count = await SuperAdmin.countDocuments({ status: 'active' });
      if (admin.status === 'active' && count <= 1) {
        err('Cannot delete the last active super admin');
      } else {
        await SuperAdmin.deleteOne({ _id: admin._id });
        ok(`${admin.email} deleted`);
      }
    } else {
      warn('Cancelled');
    }
  }

  await ask(`${C.dim}Press Enter to continue...${C.reset}`);
}

async function listCollections() {
  heading('Database collections');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  if (!collections.length) {
    warn('No collections found');
  } else {
    for (const c of collections) {
      const count = await db.collection(c.name).countDocuments();
      const stats = await db.collection(c.name).estimatedDocumentCount();
      line(
        `  ${C.bold}${c.name.padEnd(28)}${C.reset} ${C.dim}${String(count).padStart(8)}${C.reset} docs`
      );
    }
  }

  await ask(`${C.dim}Press Enter to continue...${C.reset}`);
}

async function dropCollection() {
  heading('Drop a collection');
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  if (!collections.length) {
    warn('No collections found');
    await ask(`${C.dim}Press Enter to continue...${C.reset}`);
    return;
  }

  collections.forEach((c, i) => {
    line(`  ${C.bold}${i + 1}.${C.reset} ${c.name}`);
  });
  line();
  line(`  ${C.dim}0.  Back${C.reset}`);
  line();

  const choice = await ask(`${C.cyan}›${C.reset} Select collection: `);
  const index = parseInt(choice, 10) - 1;

  if (isNaN(index) || index < 0 || index >= collections.length) return;

  const name = collections[index].name;
  const confirm = await ask(`${C.red}Type ${name} to confirm drop:${C.reset} `);

  if (confirm === name) {
    await db.collection(name).drop().catch(() => {});
    ok(`Collection "${name}" dropped`);
  } else {
    warn('Cancelled');
  }

  await ask(`${C.dim}Press Enter to continue...${C.reset}`);
}

async function dropDatabase() {
  heading('Drop entire database');

  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  warn(`This will permanently delete ALL data in "${dbName}".`);
  line();

  const confirm = await ask(`${C.red}Type ${dbName} to confirm:${C.reset} `);

  if (confirm !== dbName) {
    warn('Cancelled');
    await ask(`${C.dim}Press Enter to continue...${C.reset}`);
    return;
  }

  const second = await ask(`${C.red}Type DROP DATABASE to confirm again:${C.reset} `);
  if (second !== 'DROP DATABASE') {
    warn('Cancelled');
    await ask(`${C.dim}Press Enter to continue...${C.reset}`);
    return;
  }

  await db.dropDatabase();
  ok(`Database "${dbName}" dropped`);

  await ask(`${C.dim}Press Enter to continue...${C.reset}`);
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
      if (choice === '1') await listSuperAdmins();
      else if (choice === '2') await createSuperAdmin();
      else if (choice === '3') await manageSuperAdmin();
      else if (choice === '4') await listCollections();
      else if (choice === '5') await dropCollection();
      else if (choice === '6') await dropDatabase();
      else if (choice === '0') break;
    } catch (e) {
      err(e.message);
      await ask(`${C.dim}Press Enter to continue...${C.reset}`);
    }
  }

  rl.close();
  await disconnectDB();
  line();
  ok('Bye');
  process.exit(0);
}

main();