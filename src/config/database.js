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
async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');
  } catch (err) {
    console.error('[DB] Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
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
