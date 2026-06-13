// ─── Prisma Client Singleton ────────────────────────────────────────────────
// Prevents multiple instances in development due to hot-reloading.
// Usage:  const { prisma } = require('./config/database');

const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error'],
  });
} else {
  // In development, reuse the client across hot-reloads
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['query', 'warn', 'error'],
    });
  }
  prisma = global.__prisma;
}

/**
 * Connect to the database and log success/failure.
 * Call this once during server startup.
 */
async function connectDatabase({ retries = 5, delayMs = 5000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$connect();
      console.log('[DB] Connected to PostgreSQL');
      await ensureSchemaPatches();
      return;
    } catch (err) {
      console.error(`[DB] Connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        console.log(`[DB] Retrying in ${delayMs / 1000}s (Neon may be waking up)...`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        console.error('[DB] All connection attempts failed. Exiting.');
        process.exit(1);
      }
    }
  }
}

/**
 * Idempotent runtime schema patches that keep an already-deployed database in
 * sync with the current Prisma schema without a full migration cycle.
 *
 * The original migration shipped the SubscriptionPlan enum as
 * ('FREE','BASIC','PRO','ENTERPRISE'). The plan catalog was later renamed
 * BASIC → CORE, but no migration was applied to the live database — so every
 * attempt to activate the Core plan failed with a Postgres enum error
 * ("invalid input value for enum SubscriptionPlan: 'CORE'"), surfacing as
 * "Failed to activate plan" in the UI. `ADD VALUE IF NOT EXISTS` is idempotent
 * and safe to run on every boot.
 */
async function ensureSchemaPatches() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'CORE'`
    );
  } catch (err) {
    console.warn('[DB] schema patch (SubscriptionPlan.CORE) skipped:', err.message);
  }
}

/**
 * Gracefully disconnect. Call during shutdown.
 */
async function disconnectDatabase() {
  await prisma.$disconnect();
  console.log('[DB] Disconnected from PostgreSQL');
}

module.exports = { prisma, connectDatabase, disconnectDatabase };
