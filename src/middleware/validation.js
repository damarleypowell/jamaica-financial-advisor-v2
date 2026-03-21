/**
 * Input Validation Middleware
 * Uses Zod for schema validation to prevent injection attacks
 */

"use strict";

const { z } = require("zod");

// ─── Reusable Schemas ────────────────────────────────────

const symbolSchema = z.string().min(1).max(20).regex(/^[A-Za-z0-9.]+$/, "Invalid symbol format");

const emailSchema = z.string().email().max(255).transform(s => s.toLowerCase().trim());

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const usernameSchema = z.string()
  .min(2, "Username must be at least 2 characters")
  .max(50)
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, hyphens, dashes");

// ─── Request Schemas ─────────────────────────────────────

const schemas = {
  signup: z.object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    fullName: z.string().min(1).max(100).optional(),
  }),

  login: z.object({
    email: emailSchema.or(usernameSchema), // allow login with email or username
    password: z.string().min(1).max(128),
  }),

  placeOrder: z.object({
    symbol: symbolSchema,
    side: z.enum(["buy", "sell", "BUY", "SELL"]),
    type: z.enum(["market", "limit", "stop", "stop_limit"]).default("market"),
    quantity: z.number().positive().max(1000000),
    limitPrice: z.number().positive().optional(),
    stopPrice: z.number().positive().optional(),
  }),

  chat: z.object({
    messages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(10000),
    })).min(1).max(50),
    context: z.string().max(5000).optional(),
  }),

  analyze: z.object({
    user_input: z.string().min(1).max(5000),
    experience_level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  }),

  financialPlan: z.object({
    goals: z.string().min(1).max(2000),
    riskTolerance: z.string().or(z.number()),
    currentSavings: z.number().min(0).optional(),
    monthlyContribution: z.number().min(0).optional(),
    timeHorizon: z.string().or(z.number()).optional(),
    portfolio: z.array(z.any()).optional(),
  }),

  walletDeposit: z.object({
    amount: z.number().positive().max(100000000),
    currency: z.enum(["JMD", "USD"]).default("JMD"),
  }),

  walletWithdraw: z.object({
    amount: z.number().positive(),
    currency: z.enum(["JMD", "USD"]).default("JMD"),
  }),

  compoundGrowth: z.object({
    principal: z.number().min(0).max(1e12),
    monthlyContribution: z.number().min(0).max(1e9),
    annualRate: z.number().min(0).max(1),
    years: z.number().min(1).max(100),
  }),

  retirement: z.object({
    currentAge: z.number().int().min(16).max(80),
    retirementAge: z.number().int().min(30).max(100),
    monthlyExpenses: z.number().positive(),
    inflationRate: z.number().min(0).max(0.3).optional(),
  }),

  loan: z.object({
    principal: z.number().positive().max(1e12),
    annualRate: z.number().positive().max(1),
    years: z.number().positive().max(50),
  }),
};

// ─── Validation Middleware Factory ────────────────────────

/**
 * Creates Express middleware that validates req.body against a Zod schema
 * @param {string} schemaName - Key from the schemas object
 */
function validate(schemaName) {
  const schema = schemas[schemaName];
  if (!schema) throw new Error(`Unknown validation schema: ${schemaName}`);

  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    req.body = result.data; // use sanitized data
    next();
  };
}

/**
 * Sanitize a string to prevent XSS — strips HTML tags
 */
function sanitize(str) {
  if (typeof str !== "string") return str;
  return str.replace(/<[^>]*>/g, "").trim();
}

/**
 * Middleware to sanitize all string fields in req.body
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === "object") {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj) {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "string") {
      obj[key] = sanitize(obj[key]);
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

module.exports = { validate, sanitize, sanitizeBody, schemas };
