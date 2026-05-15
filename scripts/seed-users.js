#!/usr/bin/env node
// Creates admin + test user accounts in the Neon DB
// Usage: node scripts/seed-users.js

require("dotenv").config();
const { Client } = require("pg");
const crypto = require("crypto");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
    .toString("hex");
  return { hash, salt };
}

const ACCOUNTS = [
  {
    email:    "damarleypowellbusiness@gmail.com",
    name:     "Damarley Powell",
    password: "GothamAdmin@2026!",
    plan:     "ENTERPRISE",
    role:     "ADMIN",
  },
  {
    email:    "testuser@gothamfinancial.com",
    name:     "Test User",
    password: "TestUser@2026!",
    plan:     "PRO",
    role:     "USER",
  },
];

async function upsertAccount(client, acct) {
  const existing = await client.query(
    'SELECT id FROM users WHERE email = $1',
    [acct.email]
  );

  let userId;

  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
    // Update password in case it changed
    const { hash, salt } = hashPassword(acct.password);
    await client.query(
      `UPDATE users SET "passwordHash"=$1, salt=$2, "emailVerified"=true,
       "onboardingCompleted"=true, "isActive"=true, "updatedAt"=NOW()
       WHERE id=$3`,
      [hash, salt, userId]
    );
    console.log(`  ↺  Updated:  ${acct.email}`);
  } else {
    const { hash, salt } = hashPassword(acct.password);
    userId = crypto.randomUUID();

    await client.query(`
      INSERT INTO users (
        id, email, name, "passwordHash", salt,
        "kycStatus", settings, "isActive", "emailVerified",
        "onboardingCompleted", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5,
        'VERIFIED', '{"theme":"dark","notifications":true}', true, true,
        true, NOW(), NOW()
      )
    `, [userId, acct.email, acct.name, hash, salt]);

    // Wallets
    await client.query(`
      INSERT INTO wallets (id, "userId", currency, balance, "heldBalance", "updatedAt")
      VALUES
        ($1, $2, 'JMD', 1000000, 0, NOW()),
        ($3, $2, 'USD', 5000,    0, NOW())
    `, [crypto.randomUUID(), userId, crypto.randomUUID()]);

    console.log(`  ✓  Created:  ${acct.email}`);
  }

  // Upsert subscription
  await client.query(`
    INSERT INTO subscriptions (id, "userId", plan, status, "currentPeriodEnd", "createdAt")
    VALUES ($1, $2, $3, 'ACTIVE', '2099-12-31', NOW())
    ON CONFLICT ("userId") DO UPDATE
      SET plan=$3, status='ACTIVE', "currentPeriodEnd"='2099-12-31'
  `, [crypto.randomUUID(), userId, acct.plan]);

  return userId;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected to database.\n");

  for (const acct of ACCOUNTS) {
    await upsertAccount(client, acct);
  }

  await client.end();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ACCOUNT CREDENTIALS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  for (const acct of ACCOUNTS) {
    console.log(`  [${acct.role}]`);
    console.log(`  Email    : ${acct.email}`);
    console.log(`  Password : ${acct.password}`);
    console.log(`  Plan     : ${acct.plan}`);
    console.log();
  }

  console.log("  Both accounts have $1,000,000 JMD + $5,000 USD wallets.");
  console.log("  emailVerified=true so no email confirmation needed.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
