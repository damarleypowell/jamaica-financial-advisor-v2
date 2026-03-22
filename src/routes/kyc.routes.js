const { Router } = require("express");
const { authMiddleware } = require("../middleware/auth");
const { logAudit } = require("../services/audit.service");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

let prisma;
try {
  prisma = require("../config/database").prisma;
} catch (_) {
  prisma = null;
}
const USE_DB = !!(process.env.DATABASE_URL && prisma);

const router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads", "kyc");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/kyc/status — Get user's KYC status
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/kyc/status", authMiddleware, async (req, res) => {
  try {
    if (!USE_DB) {
      return res.json({ kycStatus: "NONE", message: "KYC requires database mode" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { kycStatus: true, settings: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const settings = typeof user.settings === "object" ? user.settings : {};
    res.json({
      kycStatus: user.kycStatus,
      documents: settings.kycDocuments || [],
      submittedAt: settings.kycSubmittedAt || null,
      reviewedAt: settings.kycReviewedAt || null,
    });
  } catch (err) {
    console.error("[kyc/status] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/kyc/submit — Submit KYC documents
// Accepts base64-encoded document images
// ══════════════════════════════════════════════════════════════════════════════
router.post("/api/kyc/submit", authMiddleware, async (req, res) => {
  try {
    if (!USE_DB) {
      return res.status(503).json({ error: "KYC requires database mode" });
    }

    const { documentType, documentData, fullLegalName, dateOfBirth, nationality, address } = req.body;

    if (!documentType || !documentData || !fullLegalName || !dateOfBirth) {
      return res.status(400).json({
        error: "Required fields: documentType, documentData (base64), fullLegalName, dateOfBirth",
      });
    }

    const validTypes = ["passport", "drivers_license", "national_id", "tax_id"];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({ error: `Invalid document type. Must be one of: ${validTypes.join(", ")}` });
    }

    // Save document (in production, use S3/CloudStorage)
    const fileId = crypto.randomUUID();
    const ext = "png"; // Base64 images saved as PNG
    const fileName = `${req.user.id}_${documentType}_${fileId}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    // Extract base64 data (strip data:image/...;base64, prefix)
    const base64Data = documentData.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

    // Update user KYC status
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { settings: true },
    });
    const settings = typeof user.settings === "object" ? user.settings : {};
    const docs = settings.kycDocuments || [];
    docs.push({
      id: fileId,
      type: documentType,
      fileName,
      uploadedAt: new Date().toISOString(),
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        kycStatus: "PENDING",
        settings: {
          ...settings,
          kycDocuments: docs,
          kycSubmittedAt: new Date().toISOString(),
          kycFullName: fullLegalName,
          kycDateOfBirth: dateOfBirth,
          kycNationality: nationality || null,
          kycAddress: address || null,
        },
      },
    });

    logAudit("KYC_SUBMITTED", {
      userId: req.user.id,
      documentType,
      documentId: fileId,
      ip: req.ip,
    });

    res.json({
      message: "KYC documents submitted successfully. Review typically takes 1-2 business days.",
      kycStatus: "PENDING",
      documentId: fileId,
    });
  } catch (err) {
    console.error("[kyc/submit] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/kyc/review — Admin: Review KYC submission
// ══════════════════════════════════════════════════════════════════════════════
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

router.post("/api/admin/kyc/review", authMiddleware, async (req, res) => {
  try {
    if (!ADMIN_EMAILS.includes(req.user.email?.toLowerCase())) {
      return res.status(403).json({ error: "Admin access required" });
    }
    if (!USE_DB) return res.status(503).json({ error: "Requires database mode" });

    const { userId, approved, reason } = req.body;
    if (!userId || typeof approved !== "boolean") {
      return res.status(400).json({ error: "Required: userId, approved (boolean)" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const settings = typeof user.settings === "object" ? user.settings : {};
    await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: approved ? "VERIFIED" : "REJECTED",
        settings: {
          ...settings,
          kycReviewedAt: new Date().toISOString(),
          kycReviewedBy: req.user.id,
          kycRejectionReason: approved ? null : (reason || "Documents did not meet requirements"),
        },
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId,
        title: approved ? "KYC Verified" : "KYC Rejected",
        body: approved
          ? "Your identity has been verified. You can now make withdrawals and access all features."
          : `Your KYC submission was rejected: ${reason || "Documents did not meet requirements"}. Please resubmit.`,
        type: "KYC",
      },
    });

    logAudit("KYC_REVIEWED", {
      adminId: req.user.id,
      targetUserId: userId,
      approved,
      reason,
      ip: req.ip,
    });

    res.json({ message: `KYC ${approved ? "approved" : "rejected"} for user ${userId}` });
  } catch (err) {
    console.error("[admin/kyc/review] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/kyc/pending — Admin: List pending KYC submissions
// ══════════════════════════════════════════════════════════════════════════════
router.get("/api/admin/kyc/pending", authMiddleware, async (req, res) => {
  try {
    if (!ADMIN_EMAILS.includes(req.user.email?.toLowerCase())) {
      return res.status(403).json({ error: "Admin access required" });
    }
    if (!USE_DB) return res.json({ users: [] });

    const users = await prisma.user.findMany({
      where: { kycStatus: "PENDING" },
      select: {
        id: true, name: true, email: true, kycStatus: true, settings: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      users: users.map((u) => {
        const s = typeof u.settings === "object" ? u.settings : {};
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          submittedAt: s.kycSubmittedAt,
          fullLegalName: s.kycFullName,
          dateOfBirth: s.kycDateOfBirth,
          nationality: s.kycNationality,
          documents: (s.kycDocuments || []).map((d) => ({ type: d.type, uploadedAt: d.uploadedAt })),
        };
      }),
    });
  } catch (err) {
    console.error("[admin/kyc/pending] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
