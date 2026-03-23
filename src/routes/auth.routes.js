const { Router } = require("express");
const crypto = require("crypto");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const {
  signJWT,
  signJWTWithIP,
  verifyJWT,
  hashPassword,
  hashPasswordAsync,
  verifyPassword,
  authMiddleware,
  getUsersDB,
  saveUsersDB,
} = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { logAudit, AuditAction } = require("../services/audit.service");
const {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} = require("../services/email.service");

// ── Revoked tokens (in-memory session revocation) ────────────────────────────
const revokedTokens = new Set();

// ── Brute Force Protection (in-memory) ───────────────────────────────────────
const failedLoginAttempts = new Map();
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check if an email is locked out due to too many failed login attempts.
 * Returns { locked: boolean, remainingMs: number }
 */
function checkLockout(email) {
  const entry = failedLoginAttempts.get(email);
  if (!entry) return { locked: false, remainingMs: 0 };

  const now = Date.now();

  // If locked out, check if lockout has expired
  if (entry.lockedUntil) {
    if (now < entry.lockedUntil) {
      return { locked: true, remainingMs: entry.lockedUntil - now };
    }
    // Lockout expired — reset
    failedLoginAttempts.delete(email);
    return { locked: false, remainingMs: 0 };
  }

  // Clean up old attempts outside the window
  entry.attempts = entry.attempts.filter((t) => now - t < LOCKOUT_WINDOW_MS);
  if (entry.attempts.length === 0) {
    failedLoginAttempts.delete(email);
  }

  return { locked: false, remainingMs: 0 };
}

/**
 * Record a failed login attempt. Returns true if account is now locked.
 */
function recordFailedAttempt(email) {
  const now = Date.now();
  let entry = failedLoginAttempts.get(email);

  if (!entry) {
    entry = { attempts: [], lockedUntil: null };
    failedLoginAttempts.set(email, entry);
  }

  // Clean old attempts
  entry.attempts = entry.attempts.filter((t) => now - t < LOCKOUT_WINDOW_MS);
  entry.attempts.push(now);

  if (entry.attempts.length >= LOCKOUT_THRESHOLD) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    return true;
  }

  return false;
}

/**
 * Clear failed login attempts on successful login.
 */
function clearFailedAttempts(email) {
  failedLoginAttempts.delete(email);
}

// Clean up expired lockout entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of failedLoginAttempts) {
    if (entry.lockedUntil && now > entry.lockedUntil) {
      failedLoginAttempts.delete(email);
    } else if (entry.attempts) {
      entry.attempts = entry.attempts.filter((t) => now - t < LOCKOUT_WINDOW_MS);
      if (entry.attempts.length === 0 && !entry.lockedUntil) {
        failedLoginAttempts.delete(email);
      }
    }
  }
}, 10 * 60 * 1000);

// ── Password Policy ──────────────────────────────────────────────────────────

const COMMON_PASSWORDS = new Set([
  "password123", "qwerty123456", "123456789012", "password1234",
  "qwerty123456", "iloveyou1234", "admin1234567", "welcome12345",
  "monkey1234567", "dragon123456", "master123456", "letmein123456",
  "football12345", "shadow123456", "sunshine12345", "trustno1234",
  "princess12345", "baseball12345", "superman12345", "michael12345",
  "password12345", "1234567890ab", "abcdef123456", "password!234",
  "qwertyuiop12", "abc123456789", "password1!", "changeme1234",
  "welcome1234!", "passw0rd1234", "p@ssword1234", "p@ssw0rd1234",
  "admin12345678", "root12345678", "toor12345678", "access123456",
  "login1234567", "master1234567", "hello1234567", "charlie12345",
  "donald123456", "loveme1234567", "batman12345678", "access1234567",
  "hello12345678", "charlie123456", "123456abcdef", "password123!",
  "qwerty12345!", "abcdefghij12", "1234abcdefgh", "testpassword1",
  "mypassword123", "yourpassword1", "thepassword1", "password0000",
  "p@$$w0rd1234", "letmein12345", "welcome12345", "monkey12345!",
  "dragon12345!", "master12345!", "football1234", "shadow12345!",
  "sunshine1234", "trustno12345", "princess1234", "baseball1234",
  "superman1234", "michael1234!", "jordan123456", "thomas123456",
  "hunter123456", "ranger123456", "buster123456", "soccer123456",
  "harley123456", "george123456", "andrew123456", "joshua123456",
  "pepper123456", "tigger123456", "samantha1234", "charlie1234!",
  "robert123456", "daniel123456", "matthew12345", "jessica12345",
  "jennifer1234", "corvette1234", "mercedes1234", "midnight1234",
  "diamond12345", "thunder12345", "computer1234", "ginger123456",
  "internet1234", "password1!@#", "qwerty1234!@", "asdfgh123456",
  "zxcvbn123456", "pokemon12345", "starwars1234", "whatever1234",
  "freedom12345", "forever12345", "nothing12345", "gateway12345",
  "creative1234", "password#123", "secure123456", "jamaica12345",
]);

/**
 * Validate password against security policy.
 * Returns { valid: boolean, errors: string[] }
 */
function validatePasswordPolicy(password, email, name) {
  const errors = [];

  if (!password || typeof password !== "string") {
    return { valid: false, errors: ["Password is required"] };
  }

  if (password.length < 12) {
    errors.push("Password must be at least 12 characters long");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%^&*()_+\-=]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&*()_+-=)");
  }

  // Check if password contains email or name
  const pwLower = password.toLowerCase();
  if (email) {
    const emailLocal = email.toLowerCase().split("@")[0];
    if (emailLocal.length >= 3 && pwLower.includes(emailLocal)) {
      errors.push("Password cannot contain your email address");
    }
  }

  if (name) {
    const nameLower = name.toLowerCase().trim();
    // Check each part of the name (first, last, etc.)
    const nameParts = nameLower.split(/\s+/).filter((p) => p.length >= 3);
    for (const part of nameParts) {
      if (pwLower.includes(part)) {
        errors.push("Password cannot contain your name");
        break;
      }
    }
  }

  // Check against common passwords
  if (COMMON_PASSWORDS.has(pwLower)) {
    errors.push("This password is too common. Please choose a more unique password");
  }

  return { valid: errors.length === 0, errors };
}

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

router.post("/api/auth/signup", rateLimit.signup(), async (req, res) => {
  try {
    const { name, email, password, accountType } = req.body;
    const isPaperTrading = accountType !== "live";
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ error: "Name, email, and password required" });

    // Validate password policy
    const policyResult = validatePasswordPolicy(password, email, name);
    if (!policyResult.valid) {
      return res.status(400).json({
        error: "Password does not meet security requirements",
        details: policyResult.errors,
      });
    }

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

      const verifyToken = crypto.randomBytes(32).toString("hex");

      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash: hash,
          salt,
          emailVerified: false,
          verifyToken,
          settings: { theme: "dark", notifications: true, accountType: isPaperTrading ? "paper" : "live" },
        },
      });

      // Send verification email (fire-and-forget, don't block signup)
      sendVerificationEmail(user.email, verifyToken, user.name).catch((err) => {
        console.error("[auth/signup] Failed to send verification email:", err.message);
      });

      logAudit(AuditAction.SIGNUP, {
        ip: req.ip,
        userId: user.id,
        email: user.email,
      });

      const token = signJWTWithIP(
        { id: user.id, name: user.name, email: user.email },
        req.ip
      );
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: false,
          settings: user.settings,
        },
        message: "Account created. Please check your email to verify your account.",
      });
    }

    // ── File-based fallback ──
    const users = getUsersDB();
    if (users.find((u) => u.email === normalizedEmail)) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const verifyToken = crypto.randomBytes(32).toString("hex");

    const user = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      hash,
      salt,
      emailVerified: false,
      verifyToken,
      createdAt: new Date().toISOString(),
      portfolio: [],
      watchlist: [],
      goals: [],
      chatHistory: [],
      riskProfile: null,
      settings: { theme: "dark", notifications: true, accountType: isPaperTrading ? "paper" : "live" },
    };
    users.push(user);
    saveUsersDB(users);

    // Also store in the in-memory map for backwards compat
    verificationTokens.set(verifyToken, {
      userId: user.id,
      email: normalizedEmail,
    });

    // Send verification email (fire-and-forget)
    sendVerificationEmail(user.email, verifyToken, user.name).catch((err) => {
      console.error("[auth/signup] Failed to send verification email:", err.message);
    });

    logAudit(AuditAction.SIGNUP, {
      ip: req.ip,
      userId: user.id,
      email: user.email,
    });

    const token = signJWTWithIP(
      { id: user.id, name: user.name, email: user.email },
      req.ip
    );
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: false,
        settings: user.settings,
      },
      message: "Account created. Please check your email to verify your account.",
    });
  } catch (err) {
    console.error("[auth/signup] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/auth/login", rateLimit.login(), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const normalizedEmail = email.toLowerCase().trim();

    // ── Brute force protection: check lockout ──
    const lockout = checkLockout(normalizedEmail);
    if (lockout.locked) {
      const minutes = Math.ceil(lockout.remainingMs / 60000);
      logAudit(AuditAction.LOGIN_FAILED, {
        ip: req.ip,
        email: normalizedEmail,
        message: `Account locked out. ${minutes} minutes remaining`,
      });
      return res
        .status(401)
        .json({ error: "Invalid email or password" });
    }

    if (USE_DB) {
      // ── Prisma path ──
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (!user || !user.isActive) {
        recordFailedAttempt(normalizedEmail);
        logAudit(AuditAction.LOGIN_FAILED, {
          ip: req.ip,
          email: normalizedEmail,
          message: "Invalid credentials",
        });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const { hash } = hashPassword(password, user.salt);
      if (hash !== user.passwordHash) {
        const locked = recordFailedAttempt(normalizedEmail);
        logAudit(AuditAction.LOGIN_FAILED, {
          ip: req.ip,
          userId: user.id,
          email: normalizedEmail,
          message: locked ? "Account locked after too many attempts" : "Invalid credentials",
        });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // ── 2FA check ──
      if (user.twoFactorSecret || user.twoFactorEnabled) {
        // Issue a short-lived temp token (5 min) so the client can submit 2FA code
        const tempToken = signJWT(
          { id: user.id, email: user.email, purpose: "2fa" },
          "5m"
        );
        clearFailedAttempts(normalizedEmail);
        return res.status(200).json({ requires2FA: true, tempToken });
      }

      // ── Success: clear failed attempts ──
      clearFailedAttempts(normalizedEmail);

      logAudit(AuditAction.LOGIN_SUCCESS, {
        ip: req.ip,
        userId: user.id,
        email: normalizedEmail,
      });

      // Fetch subscription tier
      let subscriptionTier = "BASIC";
      try {
        const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
        if (sub && sub.status === "ACTIVE" && sub.plan) subscriptionTier = sub.plan;
      } catch (_) {}

      const token = signJWTWithIP(
        { id: user.id, name: user.name, email: user.email },
        req.ip
      );
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          settings: user.settings,
          subscriptionTier,
        },
      });
    }

    // ── File-based fallback ──
    const users = getUsersDB();
    const user = users.find((u) => u.email === normalizedEmail);
    if (!user) {
      recordFailedAttempt(normalizedEmail);
      logAudit(AuditAction.LOGIN_FAILED, {
        ip: req.ip,
        email: normalizedEmail,
        message: "Invalid credentials",
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { hash } = hashPassword(password, user.salt);
    if (hash !== user.hash) {
      const locked = recordFailedAttempt(normalizedEmail);
      logAudit(AuditAction.LOGIN_FAILED, {
        ip: req.ip,
        userId: user.id,
        email: normalizedEmail,
        message: locked ? "Account locked after too many attempts" : "Invalid credentials",
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // ── 2FA check (file-based) ──
    if (user.twoFactorSecret || (user.settings && user.settings.twoFactorEnabled)) {
      const tempToken = signJWT(
        { id: user.id, email: user.email, purpose: "2fa" },
        "5m"
      );
      clearFailedAttempts(normalizedEmail);
      return res.status(200).json({ requires2FA: true, tempToken });
    }

    // ── Success: clear failed attempts ──
    clearFailedAttempts(normalizedEmail);

    logAudit(AuditAction.LOGIN_SUCCESS, {
      ip: req.ip,
      userId: user.id,
      email: normalizedEmail,
    });

    const token = signJWTWithIP(
      { id: user.id, name: user.name, email: user.email },
      req.ip
    );
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

      // Fetch subscription tier
      let subscriptionTier = "BASIC";
      try {
        const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
        if (sub && sub.status === "ACTIVE" && sub.plan) subscriptionTier = sub.plan;
      } catch (_) {}

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        kycStatus: user.kycStatus,
        riskProfile: user.riskProfile,
        settings: user.settings,
        subscriptionTier,
        twoFactorEnabled: user.twoFactorEnabled || !!(user.twoFactorSecret),
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
      twoFactorEnabled: !!(user.twoFactorSecret) || !!(user.settings && user.settings.twoFactorEnabled),
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

// ── POST /api/auth/forgot-password — Request a password reset link ──────────
router.post(
  "/api/auth/forgot-password",
  rateLimit.passwordReset(),
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

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
              resetToken,
              resetTokenExpiry: expiresAt,
            },
          });

          // Send the reset email
          sendPasswordResetEmail(user.email, resetToken, user.name).catch((err) => {
            console.error("[auth/forgot-password] Failed to send reset email:", err.message);
          });

          logAudit(AuditAction.PASSWORD_RESET_REQUESTED, {
            ip: req.ip,
            userId: user.id,
            email: normalizedEmail,
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

          // Send the reset email
          sendPasswordResetEmail(user.email, resetToken, user.name).catch((err) => {
            console.error("[auth/forgot-password] Failed to send reset email:", err.message);
          });

          logAudit(AuditAction.PASSWORD_RESET_REQUESTED, {
            ip: req.ip,
            userId: user.id,
            email: normalizedEmail,
          });
        }
      }

      // Always return the same response to prevent email enumeration
      return res.json({
        message: "If that email exists, a password reset link has been sent",
      });
    } catch (err) {
      console.error("[auth/forgot-password] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── POST /api/auth/reset-password — Redeem a reset token ───────────────────
router.post(
  "/api/auth/reset-password",
  rateLimit.passwordReset(),
  async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res
          .status(400)
          .json({ error: "Token and new password are required" });
      }

      // ── Look up the user associated with this token ──
      let userEmail = null;
      let userName = null;

      if (USE_DB) {
        const user = await prisma.user.findFirst({
          where: { resetToken: token },
        });
        if (user) {
          userEmail = user.email;
          userName = user.name;
        }
      } else {
        const stored = resetTokens.get(token);
        if (stored) {
          const users = getUsersDB();
          const user = users.find((u) => u.id === stored.userId);
          if (user) {
            userEmail = user.email;
            userName = user.name;
          }
        }
      }

      // Validate password policy (even before checking token validity,
      // so we can give useful errors; the token check follows immediately)
      const policyResult = validatePasswordPolicy(newPassword, userEmail, userName);
      if (!policyResult.valid) {
        return res.status(400).json({
          error: "Password does not meet security requirements",
          details: policyResult.errors,
        });
      }

      const { hash, salt } = hashPassword(newPassword);

      if (USE_DB) {
        const user = await prisma.user.findFirst({
          where: { resetToken: token },
        });

        if (!user) {
          return res.status(400).json({ error: "Invalid or expired reset token" });
        }

        // Check expiry
        if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date()) {
          // Invalidate the expired token
          await prisma.user.update({
            where: { id: user.id },
            data: { resetToken: null, resetTokenExpiry: null },
          });
          return res.status(400).json({ error: "Invalid or expired reset token" });
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: hash,
            salt,
            resetToken: null,
            resetTokenExpiry: null,
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
        if (stored) resetTokens.delete(token);
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

// ── POST /api/auth/verify-email — Verify email with token ───────────────────
router.post(
  "/api/auth/verify-email",
  rateLimit(60000, 5),
  async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Verification token is required" });
      }

      if (USE_DB) {
        const user = await prisma.user.findFirst({
          where: { verifyToken: token },
        });

        if (!user) {
          return res.status(400).json({ error: "Invalid verification token" });
        }

        if (user.emailVerified) {
          return res.json({ message: "Email is already verified" });
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            verifyToken: null,
            kycStatus: "PENDING", // Email verified, KYC flow begins
          },
        });

        // Send welcome email (fire-and-forget)
        sendWelcomeEmail(user.email, user.name).catch((err) => {
          console.error("[auth/verify-email] Failed to send welcome email:", err.message);
        });

        logAudit(AuditAction.EMAIL_VERIFIED, {
          userId: user.id,
          ip: req.ip,
          email: user.email,
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
        delete user.verifyToken;
        saveUsersDB(users);

        // Send welcome email (fire-and-forget)
        sendWelcomeEmail(user.email, user.name).catch((err) => {
          console.error("[auth/verify-email] Failed to send welcome email:", err.message);
        });
      }
      verificationTokens.delete(token);

      logAudit(AuditAction.EMAIL_VERIFIED, {
        userId: user?.id,
        ip: req.ip,
        email: stored.email,
      });

      return res.json({ message: "Email verified successfully" });
    } catch (err) {
      console.error("[auth/verify-email] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── POST /api/auth/resend-verification — Resend the verification email ──────
router.post(
  "/api/auth/resend-verification",
  rateLimit(60000, 3),
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const newToken = crypto.randomBytes(32).toString("hex");

      if (USE_DB) {
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        // Always return success to prevent email enumeration
        if (user && !user.emailVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: { verifyToken: newToken },
          });

          sendVerificationEmail(user.email, newToken, user.name).catch((err) => {
            console.error("[auth/resend-verification] Failed to send email:", err.message);
          });

          logAudit(AuditAction.EMAIL_VERIFICATION_SENT, {
            ip: req.ip,
            userId: user.id,
            email: normalizedEmail,
          });
        }
      } else {
        const users = getUsersDB();
        const user = users.find((u) => u.email === normalizedEmail);

        if (user && !user.emailVerified) {
          user.verifyToken = newToken;
          saveUsersDB(users);

          verificationTokens.set(newToken, {
            userId: user.id,
            email: normalizedEmail,
          });

          sendVerificationEmail(user.email, newToken, user.name).catch((err) => {
            console.error("[auth/resend-verification] Failed to send email:", err.message);
          });

          logAudit(AuditAction.EMAIL_VERIFICATION_SENT, {
            ip: req.ip,
            userId: user.id,
            email: normalizedEmail,
          });
        }
      }

      return res.json({
        message: "If that email exists and is not yet verified, a new verification link has been sent",
      });
    } catch (err) {
      console.error("[auth/resend-verification] Error:", err);
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
  rateLimit.twoFactorSetup(),
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
          "Gotham Financial",
          secret
        );

        // Generate QR code as data URL
        let qrDataUrl = null;
        try {
          qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
            width: 200,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          });
        } catch (_qrErr) {
          // QR generation failed; client can fall back to otpauthUrl
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            settings: { ...settings, pendingTwoFactorSecret: secret },
          },
        });

        return res.json({ secret, otpauthUrl, qrDataUrl });
      }

      // ── File-based fallback ──
      const users = getUsersDB();
      const user = users.find((u) => u.id === req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const otpauthUrl = authenticator.keyuri(
        user.email,
        "Gotham Financial",
        secret
      );

      // Generate QR code as data URL
      let qrDataUrl = null;
      try {
        qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
          width: 200,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
      } catch (_qrErr) {
        // QR generation failed; client can fall back to otpauthUrl
      }

      if (!user.settings || typeof user.settings !== "object") {
        user.settings = {};
      }
      user.settings.pendingTwoFactorSecret = secret;
      saveUsersDB(users);

      res.json({ secret, otpauthUrl, qrDataUrl });
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
            twoFactorEnabled: true,
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
            twoFactorEnabled: false,
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

// ── POST /api/auth/2fa/login — Complete login with TOTP code + tempToken ────
router.post(
  "/api/auth/2fa/login",
  rateLimit(60000, 10),
  async (req, res) => {
    try {
      const { tempToken, code } = req.body;
      if (!tempToken || !code) {
        return res
          .status(400)
          .json({ error: "Temp token and 2FA code required" });
      }

      // Verify the short-lived temp token
      const payload = verifyJWT(tempToken);
      if (!payload || payload.purpose !== "2fa") {
        return res
          .status(401)
          .json({ error: "Invalid or expired session. Please log in again." });
      }

      if (USE_DB) {
        const user = await prisma.user.findUnique({
          where: { id: payload.id },
        });
        if (!user || !user.isActive) {
          return res.status(401).json({ error: "User not found" });
        }

        if (!user.twoFactorSecret) {
          return res.status(400).json({ error: "2FA is not configured" });
        }

        const isValid = authenticator.check(code, user.twoFactorSecret);
        if (!isValid) {
          recordFailedAttempt(user.email);
          logAudit(AuditAction.LOGIN_FAILED, {
            ip: req.ip,
            userId: user.id,
            email: user.email,
            message: "Invalid 2FA code during login",
          });
          return res.status(401).json({ error: "Invalid 2FA code" });
        }

        clearFailedAttempts(user.email);

        logAudit(AuditAction.LOGIN_SUCCESS, {
          ip: req.ip,
          userId: user.id,
          email: user.email,
          message: "2FA login completed",
        });

        // Fetch subscription tier
        let subscriptionTier2fa = "BASIC";
        try {
          const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
          if (sub && sub.status === "ACTIVE" && sub.plan) subscriptionTier2fa = sub.plan;
        } catch (_) {}

        const token = signJWTWithIP(
          { id: user.id, name: user.name, email: user.email },
          req.ip
        );
        return res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            settings: user.settings,
            subscriptionTier: subscriptionTier2fa,
          },
        });
      }

      // ── File-based fallback ──
      const users = getUsersDB();
      const user = users.find((u) => u.id === payload.id);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: "2FA is not configured" });
      }

      const isValid = authenticator.check(code, user.twoFactorSecret);
      if (!isValid) {
        recordFailedAttempt(user.email);
        logAudit(AuditAction.LOGIN_FAILED, {
          ip: req.ip,
          userId: user.id,
          email: user.email,
          message: "Invalid 2FA code during login",
        });
        return res.status(401).json({ error: "Invalid 2FA code" });
      }

      clearFailedAttempts(user.email);

      logAudit(AuditAction.LOGIN_SUCCESS, {
        ip: req.ip,
        userId: user.id,
        email: user.email,
        message: "2FA login completed",
      });

      const token = signJWTWithIP(
        { id: user.id, name: user.name, email: user.email },
        req.ip
      );
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
      console.error("[auth/2fa/login] Error:", err);
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
