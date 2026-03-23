#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// Seed Admin Account
// Usage: node scripts/seed-admin.js
// ══════════════════════════════════════════════════════════════════════════════

require("dotenv").config();
const { Client } = require("pg");
const crypto = require("crypto");

const ADMIN_EMAIL = "damarleypowellbusiness@gmail.com";
const ADMIN_NAME = "Damarley Powell";
const ADMIN_PASSWORD = "GothamAdmin@2026!";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
    .toString("hex");
  return { hash, salt };
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const existing = await client.query(
    'SELECT id FROM users WHERE email = $1',
    [ADMIN_EMAIL]
  );

  if (existing.rows.length > 0) {
    const userId = existing.rows[0].id;
    console.log(`Admin account already exists: ${ADMIN_EMAIL}`);

    await client.query(`
      INSERT INTO subscriptions (id, "userId", plan, status, "currentPeriodEnd", "createdAt")
      VALUES ($1, $2, 'PRO', 'ACTIVE', '2099-12-31', NOW())
      ON CONFLICT ("userId") DO UPDATE SET plan = 'PRO', status = 'ACTIVE', "currentPeriodEnd" = '2099-12-31'
    `, [crypto.randomUUID(), userId]);

    console.log("Admin has PRO subscription.");
  } else {
    const { hash, salt } = hashPassword(ADMIN_PASSWORD);
    const userId = crypto.randomUUID();

    await client.query(`
      INSERT INTO users (id, email, name, "passwordHash", salt, "kycStatus", settings, "isActive", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, 'NONE', '{"theme":"dark","notifications":true}', true, NOW(), NOW())
    `, [userId, ADMIN_EMAIL, ADMIN_NAME, hash, salt]);

    await client.query(`
      INSERT INTO subscriptions (id, "userId", plan, status, "currentPeriodEnd", "createdAt")
      VALUES ($1, $2, 'PRO', 'ACTIVE', '2099-12-31', NOW())
    `, [crypto.randomUUID(), userId]);

    await client.query(`
      INSERT INTO wallets (id, "userId", currency, balance, "heldBalance", "updatedAt")
      VALUES ($1, $2, 'JMD', 0, 0, NOW()), ($3, $2, 'USD', 0, 0, NOW())
    `, [crypto.randomUUID(), userId, crypto.randomUUID()]);

    console.log("Admin account created successfully!");
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`  Plan:     PRO`);
    console.log("\n  IMPORTANT: Change this password after first login!");
  }

  await client.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
