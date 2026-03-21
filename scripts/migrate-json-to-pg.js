#!/usr/bin/env node
// ─── Migrate data/users.json into PostgreSQL via Prisma ─────────────────────
// Usage:  node scripts/migrate-json-to-pg.js
//
// Prerequisites:
//   1. DATABASE_URL is set in .env
//   2. `npx prisma migrate dev` has been run
//   3. `npx prisma generate` has been run

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['warn', 'error'] });

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

async function main() {
  console.log('[migrate] Reading', USERS_FILE);

  if (!fs.existsSync(USERS_FILE)) {
    console.error('[migrate] data/users.json not found. Nothing to migrate.');
    process.exit(1);
  }

  const raw = fs.readFileSync(USERS_FILE, 'utf-8');
  const users = JSON.parse(raw);

  if (!Array.isArray(users) || users.length === 0) {
    console.log('[migrate] No users to migrate.');
    return;
  }

  console.log(`[migrate] Found ${users.length} user(s) to migrate.\n`);

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`  SKIP  ${u.email} (already exists as ${existing.id})`);
      continue;
    }

    // Wrap each user migration in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create user
      const user = await tx.user.create({
        data: {
          id:           u.id,
          email:        u.email,
          name:         u.name || u.email.split('@')[0],
          passwordHash: u.hash,
          salt:         u.salt,
          riskProfile:  u.riskProfile || null,
          settings:     u.settings || {},
          createdAt:    u.createdAt ? new Date(u.createdAt) : new Date(),
        },
      });

      // 2. Create default wallets
      //    - JMD wallet with J$1,000,000 for paper trading
      //    - USD wallet with $0
      await tx.wallet.createMany({
        data: [
          { userId: user.id, currency: 'JMD', balance: 1000000, heldBalance: 0 },
          { userId: user.id, currency: 'USD', balance: 0,       heldBalance: 0 },
        ],
      });

      // 3. Migrate portfolio positions (if any)
      if (Array.isArray(u.portfolio) && u.portfolio.length > 0) {
        await tx.portfolioPosition.createMany({
          data: u.portfolio.map((p) => ({
            userId:   user.id,
            symbol:   p.symbol,
            market:   p.market || 'JSE',
            shares:   p.shares || 0,
            avgCost:  p.avgCost || p.buyPrice || 0,
            currency: p.currency || 'JMD',
            isPaper:  true,
          })),
        });
      }

      // 4. Migrate watchlist (if any)
      if (Array.isArray(u.watchlist) && u.watchlist.length > 0) {
        await tx.watchlist.create({
          data: {
            userId:  user.id,
            name:    'My Watchlist',
            symbols: u.watchlist,
          },
        });
      }

      // 5. Migrate financial goals (if any)
      if (Array.isArray(u.goals) && u.goals.length > 0) {
        await tx.financialGoal.createMany({
          data: u.goals.map((g) => ({
            userId:       user.id,
            name:         g.name || 'Unnamed Goal',
            targetAmount: g.targetAmount || 0,
            currentAmount: g.currentAmount || 0,
            targetDate:   g.targetDate ? new Date(g.targetDate) : null,
            category:     g.category || null,
          })),
        });
      }

      // 6. Migrate chat history (if any)
      if (Array.isArray(u.chatHistory) && u.chatHistory.length > 0) {
        await tx.chatHistory.createMany({
          data: u.chatHistory.map((msg) => ({
            userId:  user.id,
            role:    msg.role,
            content: msg.content,
            context: msg.context || null,
          })),
        });
      }

      return user;
    });

    console.log(`  OK    ${result.email} -> ${result.id}`);

    // Count what was created
    const walletCount = 2;
    const posCount = Array.isArray(u.portfolio) ? u.portfolio.length : 0;
    const watchCount = (Array.isArray(u.watchlist) && u.watchlist.length > 0) ? 1 : 0;
    const goalCount = Array.isArray(u.goals) ? u.goals.length : 0;
    const chatCount = Array.isArray(u.chatHistory) ? u.chatHistory.length : 0;
    console.log(`        wallets: ${walletCount}, positions: ${posCount}, watchlists: ${watchCount}, goals: ${goalCount}, chat messages: ${chatCount}`);
  }

  console.log('\n[migrate] Done.');
}

main()
  .catch((err) => {
    console.error('[migrate] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
