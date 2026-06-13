// ══════════════════════════════════════════════════════════════════════════════
// ── AI Model Tiering ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
//
// Single source of truth for which Claude model each subscription tier uses.
//
//   FREE / CORE  → Sonnet  (fast, strong, cost-efficient)   — with a daily chat cap
//   PRO / ENT    → Opus    (most capable)                    — unlimited
//
// Model IDs are env-overridable so they can be bumped without a code change.
// (OpenAI / "ChatGPT 4.1" would require an OPENAI_API_KEY + the openai SDK, which
//  this deployment does not have configured — so we use Claude across the board.)

const MODELS = {
  HAIKU: process.env.AI_MODEL_HAIKU || "claude-haiku-4-5-20251001",
  SONNET: process.env.AI_MODEL_SONNET || "claude-sonnet-4-6",
  OPUS: process.env.AI_MODEL_OPUS || "claude-opus-4-8",
};

// Tier → model. Anything unknown falls back to Sonnet.
const TIER_MODEL = {
  FREE: MODELS.SONNET,
  CORE: MODELS.SONNET,
  PRO: MODELS.OPUS,
  ENTERPRISE: MODELS.OPUS,
};

/**
 * Resolve the Claude model id for a given subscription tier.
 * @param {string} tier  FREE | CORE | PRO | ENTERPRISE
 * @returns {string} model id
 */
function modelForTier(tier) {
  return TIER_MODEL[tier] || MODELS.SONNET;
}

module.exports = { MODELS, TIER_MODEL, modelForTier };
