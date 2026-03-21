const { Router } = require("express");
const crypto = require("crypto");
const { authenticator } = require("otplib");
const {
  signJWT,
  hashPassword,
  authMiddleware,
  getUsersDB,
  saveUsersDB,
} = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { logAudit, AuditAction } = require("../services/audit.service");

// ── Revoked tokens (in-memory session revocation) ────────────────────────────
const revokedTokens = new Set();

// ── Prisma / DB toggle ───────────────────────────────────────────────────────
let prisma;
try {
  prisma = require("../config/database").prisma;
} catch (_) {
  prisma = null;
}
const USE_DB = !!(process.env.DATABASE_URL && prisma);

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// ── Auth Routes ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post("/api/auth/signup", rateLimit(60000, 5), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ error: "Name, email, and password required" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ error: "Invalid email format" });

    const normalizedEmail = email.toLowerCase().trim();
    const { hash, salt } = hashPassword(password);

    if (USE_DB) {
      // ── Prisma path ──
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash: hash,
          salt,
          settings: { theme: "dark", notifications: true },
        },
      });

      logAudit(AuditAction.SIGNUP, {
        ip: req.ip,
        userId: user.id,
        email: user.email,
      });

      const token = signJWT({
        id: user.id,
        name: user.name,
        email: user.email,
      });
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          settings: user.settings,
        },
      });
    }

    // ── File-based fallback ──
    const users = getUsersDB();
    if (users.find((u) => u.email === normalizedEmail)) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const user = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      hash,
      salt,
      createdAt: new Date().toISOString(),
      portfolio: [],
      watchlist: [],
      goals: [],
      chatHistory: [],
      riskProfile: null,
      settings: { theme: "dark", notifications: true },
    };
    users.push(user);
    saveUsersDB(users);

    logAudit(AuditAction.SIGNUP, {
      ip: req.ip,
      userId: user.id,
      email: user.email,
    });

    const token = signJWT({
      id: user.id,
      name: user.name,
      email: user.email,
    });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        settings: user.settings,
      },
    });
  } catch (err) {
    console.error("[auth/signup] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/auth/login", rateLimit(60000, 10), async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const normalizedEmail = email.toLowerCase().trim();

    if (USE_DB) {
      // ── Prisma path ──
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (!user || !user.isActive) {
        logAudit(AuditAction.LOGIN_FAILED, {
          ip: req.ip,
          email: normalizedEmail,
          message: "Unknown email",
        });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const { hash } = hashPassword(password, user.salt);
      if (hash !== user.passwordHash) {
        logAudit(AuditAction.LOGIN_FAILED, {
          ip: req.ip,
          userId: user.id,
          email: normalizedEmail,
          message: "Wrong password",
        });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // ── 2FA check ──
      if (user.twoFactorSecret) {
        if (!twoFactorToken) {
          return res.status(200).json({ requires2FA: true });
        }
        const isValid = authenticator.check(twoFactorToken, user.twoFactorSecret);
        if (!isValid) {
          logAudit(AuditAction.LOGIN_FAILED, {
            ip: req.ip,
            userId: user.id,
            email: normalizedEmail,
            message: "Invalid 2FA code",
          });
          return res.status(401).json({ error: "Invalid 2FA code" });
        }
      }

      logAudit(AuditAction.LOGIN_SUCCESS, {
        ip: req.ip,
        userId: user.id,
        email: normalizedEmail,
      });

      const token = signJWT({
        id: user.id,
        name: user.name,
        email: user.email,
      });
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          settings: user.settings,
        },
      });
    }

    // ── File-based fallback ──
    const users = getUsersDB();
    const user = users.find((u) => u.email === normalizedEmail);
    if (!user) {
      logAudit(AuditAction.LOGIN_FAILED, {
        ip: req.ip,
        email: normalizedEmail,
        message: "Unknown email",
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { hash } = hashPassword(password, user.salt);
    if (hash !== user.hash) {
      logAudit(AuditAction.LOGIN_FAILED, {
        ip: req.ip,
        userId: user.id,
        email: normalizedEmail,
        message: "Wrong password",
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // ── 2FA check (file-based) ──
    if (user.twoFactorSecret) {
      if (!twoFactorToken) {
        return res.status(200).json({ requires2FA: true });
      }
      const isValid = authenticator.check(twoFactorToken, user.twoFactorSecret);
      if (!isValid) {
        logAudit(AuditAction.LOGIN_FAILED, {
          ip: req.ip,
          userId: user.id,
          email: normalizedEmail,
          message: "Invalid 2FA code",
        });
        return res.status(401).json({ error: "Invalid 2FA code" });
      }
    }

    logAudit(AuditAction.LOGIN_SUCCESS, {
      ip: req.ip,
      userId: user.id,
      email: normalizedEmail,
    });

    const token = signJWT({
      id: user.id,
      name: user.name,
      email: user.email,
    });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        settings: user.settings,
      },
    });
  } catch (err) {
    console.error("[auth/login] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    if (USE_DB) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          wallets: true,
          portfolioPositions: true,
          financialGoals: true,
          watchlists: true,
        },
      });
      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        kycStatus: user.kycStatus,
        riskProfile: user.riskProfile,
        settings: user.settings,
        portfolio: user.portfolioPositions,
        watchlist: user.watchlists,
        goals: user.financialGoals,
      });
    }

    // ── File-based fallback ──
    const users = getUsersDB();
    const user = users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      portfolio: user.portfolio,
      watchlist: user.watchlist,
      goals: user.goals,
      riskProfile: user.riskProfile,
      settings: user.settings,
    });
  } catch (err) {
    console.error("[auth/me] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Password Reset ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// In-memory reset token store (file-based fallback)
const resetTokens = new Map();

router.post(
  "/api/auth/reset-password",
  rateLimit(60000, 3),
  async (req, res) => {
    try {
      const { email, token, newPassword } = req.body;

      // ── Step 1: Request a reset (email only) ──
      if (email && !token) {
        const normalizedEmail = email.toLowerCase().trim();
        const resetToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        if (USE_DB) {
          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });
          // Always return success to prevent email enumeration
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                settings: {
                  ...(typeof user.settings === "object" ? user.settings : {}),
                  resetToken,
                  resetTokenExpires: expiresAt.toISOString(),
                },
              },
            });
          }
        } else {
          const users = getUsersDB();
          const user = users.find((u) => u.email === normalizedEmail);
          if (user) {
            resetTokens.set(resetToken, {
              userId: user.id,
              expiresAt: expiresAt.toISOString(),
            });
          }
        }

        // In production, send the token via email. For now, return it in dev.
        const response = { message: "If that email exists, a reset link has been sent" };
        if (process.env.NODE_ENV !== "production") {
          response.resetToken = resetToken;
        }
        return res.json(response);
      }

      // ── Step 2: Redeem the token (token + newPassword) ──
      if (token && newPassword) {
        if (newPassword.length < 6) {
          return res
            .status(400)
            .json({ error: "Password must be at least 6 characters" });
        }

        const { hash, salt } = hashPassword(newPassword);

        if (USE_DB) {
          // Search for the user with this reset token in settings
          const users = await prisma.user.findMany({
            where: {
              settings: {
                path: ["resetToken"],
                equals: token,
              },
            },
          });

          const user = users[0];
          if (!user) {
            return res.status(400).json({ error: "Invalid or expired reset token" });
          }

          const settings =
            typeof user.settings === "object" ? user.settings : {};
          if (
            settings.resetTokenExpires &&
            new Date(settings.resetTokenExpires) < new Date()
          ) {
            return res.status(400).json({ error: "Invalid or expired reset token" });
          }

          const { resetToken: _rt, resetTokenExpires: _rte, ...cleanSettings } =
            settings;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              passwordHash: hash,
              salt,
              settings: cleanSettings,
            },
          });

          logAudit(AuditAction.PASSWORD_CHANGE, {
            userId: user.id,
            ip: req.ip,
          });
          return res.json({ message: "Password reset successfully" });
        }

        // ── File-based fallback ──
        const stored = resetTokens.get(token);
        if (!stored || new Date(stored.expiresAt) < new Date()) {
          return res.status(400).json({ error: "Invalid or expired reset token" });
        }

        const users = getUsersDB();
        const user = users.find((u) => u.id === stored.userId);
        if (!user) {
          return res.status(400).json({ error: "Invalid or expired reset token" });
        }

        user.hash = hash;
        user.salt = salt;
        saveUsersDB(users);
        resetTokens.delete(token);

        logAudit(AuditAction.PASSWORD_CHANGE, {
          userId: user.id,
          ip: req.ip,
        });
        return res.json({ message: "Password reset successfully" });
      }

      return res
        .status(400)
        .json({ error: "Provide email (to request reset) or token + newPassword (to reset)" });
    } catch (err) {
      console.error("[auth/reset-password] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ── Email Verification ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// In-memory verification token store (file-based fallback)
const verificationTokens = new Map();

router.post(
  "/api/auth/verify-email",
  rateLimit(60000, 5),
  async (req, res) => {
    try {
      const { email, token } = req.body;

      // ── Step 1: Request a verification token (email only) ──
      if (email && !token) {
        const normalizedEmail = email.toLowerCase().trim();
        const verifyToken = crypto.randomBytes(32).toString("hex");

        if (USE_DB) {
          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });
          if (!user) {
            return res.json({ message: "If that email exists, a verification link has been sent" });
          }

          await prisma.user.update({
            where: { id: user.id },
            data: {
              settings: {
                ...(typeof user.settings === "object" ? user.settings : {}),
                emailVerifyToken: verifyToken,
              },
            },
          });
        } else {
          const users = getUsersDB();
          const user = users.find((u) => u.email === normalizedEmail);
          if (user) {
            verificationTokens.set(verifyToken, {
              userId: user.id,
              email: normalizedEmail,
            });
          }
        }

        const response = { message: "If that email exists, a verification link has been sent" };
        if (process.env.NODE_ENV !== "production") {
          response.verifyToken = verifyToken;
        }
        return res.json(response);
      }

      // ── Step 2: Verify the token ──
      if (token) {
        if (USE_DB) {
          const users = await prisma.user.findMany({
            where: {
              settings: {
                path: ["emailVerifyToken"],
                equals: token,
              },
            },
          });

          const user = users[0];
          if (!user) {
            return res.status(400).json({ error: "Invalid verification token" });
          }

          const settings =
            typeof user.settings === "object" ? user.settings : {};
          const { emailVerifyToken: _evt, ...cleanSettings } = settings;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              kycStatus: "PENDING", // Email verified, KYC starts
              settings: { ...cleanSettings, emailVerified: true },
            },
          });

          return res.json({ message: "Email verified successfully" });
        }

        // ── File-based fallback ──
        const stored = verificationTokens.get(token);
        if (!stored) {
          return res.status(400).json({ error: "Invalid verification token" });
        }

        const users = getUsersDB();
        const user = users.find((u) => u.id === stored.userId);
        if (user) {
          user.emailVerified = true;
          saveUsersDB(users);
        }
        verificationTokens.delete(token);

        return res.json({ message: "Email verified successfully" });
      }

      return res
        .status(400)
        .json({ error: "Provide email (to request verification) or token (to verify)" });
    } catch (err) {
      console.error("[auth/verify-email] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ── User Profile Routes ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get("/api/user/portfolio", authMiddleware, async (req, res) => {
  try {
    if (USE_DB) {
      const positions = await prisma.portfolioPosition.findMany({
        where: { userId: req.user.id },
      });
      return res.json(positions);
    }

    const users = getUsersDB();
    const user = users.find((u) => u.id === req.user.id);
    res.json(user?.portfolio || []);
  } catch (err) {
    console.error("[user/portfolio GET] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/user/portfolio", authMiddleware, async (req, res) => {
  try {
    const { portfolio } = req.body;
    if (!Array.isArray(portfolio))
      return res.status(400).json({ error: "Portfolio must be an array" });

    if (USE_DB) {
      // Replace all positions for the user
      await prisma.$transaction(async (tx) => {
        await tx.portfolioPosition.deleteMany({
          where: { userId: req.user.id },
        });
        if (portfolio.length > 0) {
          await tx.portfolioPosition.createMany({
            data: portfolio.map((p) => ({
              userId: req.user.id,
              symbol: p.symbol,
              market: p.market || "JSE",
              shares: p.shares || 0,
              avgCost: p.avgCost || 0,
              currency: p.currency || "JMD",
              isPaper: p.isPaper !== undefined ? p.isPaper : false,
            })),
          });
        }
      });
      const updated = await prisma.portfolioPosition.findMany({
        where: { userId: req.user.id },
      });
      return res.json({ ok: true, portfolio: updated });
    }

    const users = getUsersDB();
    const user = users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.portfolio = portfolio;
    saveUsersDB(users);
    res.json({ ok: true, portfolio });
  } catch (err) {
    console.error("[user/portfolio PUT] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/user/watchlist", authMiddleware, async (req, res) => {
  try {
    if (USE_DB) {
      const watchlists = await prisma.watchlist.findMany({
        where: { userId: req.user.id },
      });
      return res.json(watchlists);
    }

    const users = getUsersDB();
    const user = users.find((u) => u.id === req.user.id);
    res.json(user?.watchlist || []);
  } catch (err) {
    console.error("[user/watchlist GET] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/user/watchlist", authMiddleware, async (req, res) => {
  try {
    const { watchlist } = req.body;
    if (!Array.isArray(watchlist))
      return res.status(400).json({ error: "Watchlist must be an array" });

    if (USE_DB) {
      // Replace all watchlists for the user
      await prisma.$transaction(async (tx) => {
        await tx.watchlist.deleteMany({ where: { userId: req.user.id } });
        if (watchlist.length > 0) {
          await tx.watchlist.createMany({
            data: watchlist.map((w) => ({
              userId: req.user.id,
              name: w.name || "Default",
              symbols: Array.isArray(w.symbols) ? w.symbols : [w],
            })),
          });
        }
      });
      const updated = await prisma.watchlist.findMany({
        where: { userId: req.user.id },
      });
      return res.json({ ok: true, watchlist: updated });
    }

    const users = getUsersDB();
    const user = users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.watchlist = watchlist;
    saveUsersDB(users);
    res.json({ ok: true, watchlist });
  } catch (err) {
    console.error("[user/watchlist PUT] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/user/goals", authMiddleware, async (req, res) => {
  try {
    if (USE_DB) {
      const goals = await prisma.financialGoal.findMany({
        where: { userId: req.user.id },
      });
      return res.json(goals);
    }

    const users = getUsersDB();
    const user = users.find((u) => u.id === req.user.id);
    res.json(user?.goals || []);
  } catch (err) {
    console.error("[user/goals GET] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/user/goals", authMiddleware, async (req, res) => {
  try {
    const { goals } = req.body;
    if (!Array.isArray(goals))
      return res.status(400).json({ error: "Goals must be an array" });

    if (USE_DB) {
      await prisma.$transaction(async (tx) => {
        await tx.financialGoal.deleteMany({
          where: { userId: req.user.id },
        });
        if (goals.length > 0) {
          await tx.financialGoal.createMany({
            data: goals.map((g) => ({
              userId: req.user.id,
              name: g.name || "Untitled Goal",
              targetAmount: g.targetAmount || 0,
              currentAmount: g.currentAmount || 0,
              targetDate: g.targetDate ? new Date(g.targetDate) : null,
              category: g.category || null,
              status: g.status || "ACTIVE",
            })),
          });
        }
      });
      const updated = await prisma.financialGoal.findMany({
        where: { userId: req.user.id },
      });
      return res.json({ ok: true, goals: updated });
    }

    const users = getUsersDB();
    const user = users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.goals = goals;
    saveUsersDB(users);
    res.json({ ok: true, goals });
  } catch (err) {
    console.error("[user/goals PUT] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/user/risk-profile", authMiddleware, async (req, res) => {
  try {
    const { riskProfile } = req.body;

    if (USE_DB) {
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { riskProfile },
      });
      return res.json({ ok: true, riskProfile: user.riskProfile });
    }

    const users = getUsersDB();
    const user = users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.riskProfile = riskProfile;
    saveUsersDB(users);
    res.json({ ok: true, riskProfile });
  } catch (err) {
    console.error("[user/risk-profile] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Two-Factor Authentication (TOTP) ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post(
  "/api/auth/2fa/setup",
  authMiddleware,
  rateLimit(60000, 5),
  async (req, res) => {
    try {
      const secret = authenticator.generateSecret();

      if (USE_DB) {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
        });
        if (!user) return res.status(404).json({ error: "User not found" });

        const settings =
          typeof user.settings === "object" ? user.settings : {};
        const otpauthUrl = authenticator.keyuri(
          user.email,
          "JSE Trading",
          secret
        );

        await prisma.user.update({
          where: { id: user.id },
          data: {
            settings: { ...settings, pendingTwoFactorSecret: secret },
          },
        });

        return res.json({ secret, otpauthUrl });
      }

      // ── File-based fallback ──
      const users = getUsersDB();
      const user = users.find((u) => u.id === req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const otpauthUrl = authenticator.keyuri(
        user.email,
        "JSE Trading",
        secret
      );

      if (!user.settings || typeof user.settings !== "object") {
        user.settings = {};
      }
      user.settings.pendingTwoFactorSecret = secret;
      saveUsersDB(users);

      res.json({ secret, otpauthUrl });
    } catch (err) {
      console.error("[auth/2fa/setup] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/api/auth/2fa/verify",
  authMiddleware,
  rateLimit(60000, 5),
  async (req, res) => {
    try {
      const { token } = req.body;
      if (!token)
        return res.status(400).json({ error: "TOTP token required" });

      if (USE_DB) {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
        });
        if (!user) return res.status(404).json({ error: "User not found" });

        const settings =
          typeof user.settings === "object" ? user.settings : {};
        const pendingSecret = settings.pendingTwoFactorSecret;
        if (!pendingSecret) {
          return res
            .status(400)
            .json({ error: "No pending 2FA setup. Call /api/auth/2fa/setup first" });
        }

        const isValid = authenticator.check(token, pendingSecret);
        if (!isValid) {
          return res.status(401).json({ error: "Invalid 2FA code" });
        }

        const {
          pendingTwoFactorSecret: _pts,
          ...cleanSettings
        } = settings;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            twoFactorSecret: pendingSecret,
            settings: { ...cleanSettings, twoFactorEnabled: true },
          },
        });

        return res.json({ message: "2FA enabled successfully" });
      }

      // ── File-based fallback ──
      const users = getUsersDB();
      const user = users.find((u) => u.id === req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const pendingSecret =
        user.settings && user.settings.pendingTwoFactorSecret;
      if (!pendingSecret) {
        return res
          .status(400)
          .json({ error: "No pending 2FA setup. Call /api/auth/2fa/setup first" });
      }

      const isValid = authenticator.check(token, pendingSecret);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid 2FA code" });
      }

      user.twoFactorSecret = pendingSecret;
      delete user.settings.pendingTwoFactorSecret;
      user.settings.twoFactorEnabled = true;
      saveUsersDB(users);

      res.json({ message: "2FA enabled successfully" });
    } catch (err) {
      console.error("[auth/2fa/verify] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/api/auth/2fa/disable",
  authMiddleware,
  rateLimit(60000, 5),
  async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password)
        return res
          .status(400)
          .json({ error: "TOTP token and password required" });

      if (USE_DB) {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
        });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Verify password
        const { hash } = hashPassword(password, user.salt);
        if (hash !== user.passwordHash) {
          return res.status(401).json({ error: "Invalid password" });
        }

        // Verify TOTP
        if (!user.twoFactorSecret) {
          return res.status(400).json({ error: "2FA is not enabled" });
        }
        const isValid = authenticator.check(token, user.twoFactorSecret);
        if (!isValid) {
          return res.status(401).json({ error: "Invalid 2FA code" });
        }

        const settings =
          typeof user.settings === "object" ? user.settings : {};
        await prisma.user.update({
          where: { id: user.id },
          data: {
            twoFactorSecret: null,
            settings: { ...settings, twoFactorEnabled: false },
          },
        });

        return res.json({ message: "2FA disabled" });
      }

      // ── File-based fallback ──
      const users = getUsersDB();
      const user = users.find((u) => u.id === req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Verify password
      const { hash } = hashPassword(password, user.salt);
      if (hash !== user.hash) {
        return res.status(401).json({ error: "Invalid password" });
      }

      // Verify TOTP
      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: "2FA is not enabled" });
      }
      const isValid = authenticator.check(token, user.twoFactorSecret);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid 2FA code" });
      }

      user.twoFactorSecret = null;
      if (user.settings) {
        user.settings.twoFactorEnabled = false;
      }
      saveUsersDB(users);

      res.json({ message: "2FA disabled" });
    } catch (err) {
      console.error("[auth/2fa/disable] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ── Session Revocation / Logout ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post("/api/auth/logout", authMiddleware, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.slice(7);
    if (token) {
      revokedTokens.add(token);
    }

    // Also persist lastLogoutAt in DB for cross-restart revocation
    if (USE_DB) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });
      if (user) {
        const settings =
          typeof user.settings === "object" ? user.settings : {};
        await prisma.user.update({
          where: { id: user.id },
          data: {
            settings: {
              ...settings,
              lastLogoutAt: new Date().toISOString(),
            },
          },
        });
      }
    } else {
      const users = getUsersDB();
      const user = users.find((u) => u.id === req.user.id);
      if (user) {
        if (!user.settings || typeof user.settings !== "object") {
          user.settings = {};
        }
        user.settings.lastLogoutAt = new Date().toISOString();
        saveUsersDB(users);
      }
    }

    logAudit(AuditAction.LOGIN_SUCCESS, {
      ip: req.ip,
      userId: req.user.id,
      message: "User logged out",
    });

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("[auth/logout] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Check if a JWT token has been revoked (in-memory).
 * Imported by auth middleware to enforce session revocation.
 */
function isTokenRevoked(token) {
  return revokedTokens.has(token);
}

module.exports = router;
module.exports.revokedTokens = revokedTokens;
module.exports.isTokenRevoked = isTokenRevoked;
