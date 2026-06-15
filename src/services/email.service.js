// ══════════════════════════════════════════════════════════════════════════════
// ── Email Service — Gotham Financial Transactional Emails ────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const nodemailer = require("nodemailer");
const crypto = require("crypto");

let Resend = null;
try { ({ Resend } = require("resend")); } catch (_) { /* resend not installed */ }

// ── Configuration ────────────────────────────────────────────────────────────

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "Gotham Financial <noreply@gothamfinancial.com>";
const APP_URL = process.env.APP_URL || "https://gotham-latk.onrender.com";

// ── Resend (primary provider) ──────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
// Until a domain is verified in Resend, onboarding@resend.dev only delivers to the
// Resend account owner. After verifying your domain, set RESEND_FROM to an address
// on it (e.g. "Gotham Financial <noreply@gothamfinancial.com>").
const RESEND_FROM = process.env.RESEND_FROM || "Gotham Financial <onboarding@resend.dev>";
const resendClient = RESEND_API_KEY && Resend ? new Resend(RESEND_API_KEY) : null;
if (resendClient) console.log("  [Email] Resend transport configured (primary)");

// ── Transport ────────────────────────────────────────────────────────────────

let transporter;

if (SENDGRID_API_KEY) {
  // SendGrid SMTP relay — most reliable, free up to 100 emails/day
  transporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    auth: { user: "apikey", pass: SENDGRID_API_KEY },
  });
  console.log("  [Email] SendGrid SMTP transport configured");
} else {
  // Fallback: custom SMTP (Gmail, etc.)
  const EMAIL_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com";
  const EMAIL_PORT = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT, 10) || 587;
  const EMAIL_USER = process.env.SMTP_USER || process.env.EMAIL_USER || "";
  const EMAIL_PASS = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "").replace(/\s/g, "");

  if (EMAIL_USER && EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
    console.log(`  [Email] SMTP transport configured (${EMAIL_HOST}:${EMAIL_PORT}) as ${EMAIL_USER}`);
    // Verify credentials at startup so a bad/expired app password surfaces in the
    // logs immediately, instead of every verification email silently failing.
    transporter.verify()
      .then(() => console.log("  [Email] SMTP connection verified"))
      .catch((err) => console.warn(
        `  [Email] SMTP backup unavailable (${err.message}).` +
        (resendClient ? " Resend is primary, so email still works." : " Regenerate the Gmail App Password.")
      ));
  } else {
    transporter = {
      sendMail: async (mailOptions) => {
        console.log("\n──────────────────────────────────────────────────");
        console.log("[Email - Dev Console Transport]");
        console.log(`  To:      ${mailOptions.to}`);
        console.log(`  Subject: ${mailOptions.subject}`);
        console.log(`  Text:    ${(mailOptions.text || "").substring(0, 200)}...`);
        console.log("──────────────────────────────────────────────────\n");
        return { messageId: `dev-${Date.now()}@console` };
      },
    };
    console.log("  [Email] Console transport active (no email provider configured)");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── HTML Template ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function buildEmail({ title, preheader, greeting, body, ctaText, ctaUrl, footer }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>${title}</title>
<!--[if mso]><style>body{font-family:Arial,sans-serif!important;}</style><![endif]-->
<style>
  body { margin:0; padding:0; background:#060810; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .wrapper { width:100%; background:#060810; padding:32px 0; }
  .container { max-width:600px; margin:0 auto; background:#0c1017; border-radius:16px; border:1px solid rgba(255,255,255,0.06); overflow:hidden; }
  .header-bar { background:linear-gradient(135deg,#007a3d,#00c853); padding:28px 32px; text-align:center; }
  .header-bar h1 { margin:0; color:#fff; font-size:22px; font-weight:800; letter-spacing:0.5px; }
  .header-bar .tag { display:inline-block; margin-top:6px; background:rgba(255,255,255,0.2); color:#fff; font-size:11px; padding:3px 10px; border-radius:20px; letter-spacing:1px; text-transform:uppercase; }
  .body-content { padding:32px; color:#c0c8d4; font-size:15px; line-height:1.7; }
  .body-content h2 { color:#e8edf2; font-size:20px; margin:0 0 16px 0; }
  .body-content p { margin:0 0 14px 0; }
  .cta-btn { display:inline-block; background:linear-gradient(135deg,#007a3d,#00c853); color:#fff!important; text-decoration:none; padding:14px 36px; border-radius:10px; font-weight:700; font-size:15px; margin:20px 0; }
  .info-box { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:18px 20px; margin:18px 0; }
  .info-box .label { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#6b7a8d; margin-bottom:6px; }
  .info-box .value { font-size:18px; font-weight:700; color:#00c853; font-family:'Courier New',monospace; }
  .divider { border:none; border-top:1px solid rgba(255,255,255,0.06); margin:24px 0; }
  .footer { padding:24px 32px; text-align:center; color:#6b7a8d; font-size:12px; line-height:1.6; }
  .footer a { color:#6b7a8d; text-decoration:underline; }
  .preheader { display:none!important; visibility:hidden; mso-hide:all; font-size:1px; color:#060810; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden; }
</style>
</head>
<body>
<span class="preheader">${preheader || ""}</span>
<div class="wrapper">
<div class="container">
  <div class="header-bar">
    <h1>Gotham Financial</h1>
    <span class="tag">AI-Powered Investment Platform</span>
  </div>
  <div class="body-content">
    <h2>${greeting || "Hello"}</h2>
    ${body}
    ${ctaText && ctaUrl ? `<div style="text-align:center;"><a href="${ctaUrl}" class="cta-btn">${ctaText}</a></div>` : ""}
  </div>
  <hr class="divider"/>
  <div class="footer">
    ${footer || ""}
    <p style="margin-top:12px;">
      Gotham Financial &mdash; AI-Powered Investment Platform<br/>
      &copy; ${new Date().getFullYear()} Gotham Financial. All rights reserved.
    </p>
    <p style="margin-top:8px;">
      <a href="${APP_URL}/terms.html">Terms of Service</a> &nbsp;|&nbsp;
      <a href="${APP_URL}/terms.html#privacy">Privacy Policy</a> &nbsp;|&nbsp;
      <a href="${APP_URL}/terms.html#unsubscribe">Unsubscribe</a>
    </p>
    <p style="margin-top:6px;font-size:11px;color:#4a5568;">
      This email was sent by Gotham Financial. If you did not request this email, please ignore it.
    </p>
  </div>
</div>
</div>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Delivery (Resend primary → SMTP/console fallback) ────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Send one email. Tries Resend first (if configured); on any failure, falls back
 * to the nodemailer transport (Gmail/SendGrid SMTP, or the dev console transport).
 * @param {{from?:string,to:string,subject:string,text?:string,html?:string,headers?:object}} msg
 */
async function deliver(msg) {
  const { to, subject, text, html, headers } = msg;

  if (resendClient) {
    try {
      const result = await resendClient.emails.send({
        from: RESEND_FROM,
        to,
        subject,
        text,
        html,
        headers,
      });
      if (result && result.error) {
        throw new Error(result.error.message || JSON.stringify(result.error));
      }
      return { messageId: result?.data?.id, provider: "resend" };
    } catch (err) {
      console.error(`[Email] Resend failed for ${to} — falling back to SMTP: ${err.message}`);
    }
  }

  return transporter.sendMail({ from: msg.from || EMAIL_FROM, to, subject, text, html, headers });
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Email Functions ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Derive a stable 6-digit verification code from the (secret, server-stored)
 * verify token. The code is shown only in the email — it's never sent to the
 * browser — and verification recomputes it from the token, so no extra storage
 * or DB migration is needed.
 */
function codeFromToken(token) {
  if (!token) return "000000";
  const h = crypto.createHash("sha256").update(String(token)).digest("hex");
  return String(parseInt(h.slice(0, 8), 16) % 1000000).padStart(6, "0");
}

/**
 * Send an email verification link + 6-digit code to a newly registered user.
 */
async function sendVerificationEmail(email, token, name) {
  const verifyUrl = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const code = codeFromToken(token);
  const html = buildEmail({
    title: "Verify Your Email — Gotham Financial",
    preheader: "Verify your email to activate your Gotham Financial account.",
    greeting: `Welcome, ${name || "Investor"}!`,
    body: `
      <p>Thanks for joining Gotham Financial. Enter this 6-digit code in the app to verify your email:</p>
      <div class="info-box" style="text-align:center;">
        <div class="label">Your verification code</div>
        <div class="value" style="font-size:30px;letter-spacing:8px;color:#00c853;">${code}</div>
      </div>
      <p>Or just tap the button below. Either way, this expires in <strong>24 hours</strong>.</p>
    `,
    ctaText: "Verify My Email",
    ctaUrl: verifyUrl,
    footer: `<p>If the button doesn't work, copy and paste this link into your browser:<br/><a href="${verifyUrl}" style="word-break:break-all;">${verifyUrl}</a></p>`,
  });

  try {
    return await deliver({
      from: EMAIL_FROM,
      to: email,
      subject: `Your Gotham Financial code: ${code}`,
      text: `Welcome to Gotham Financial, ${name || "Investor"}! Your verification code is ${code}. Or verify here: ${verifyUrl}`,
      html,
      headers: {
        "X-Mailer": "Gotham-Financial/2.0",
        "List-Unsubscribe": `<${APP_URL}/api/auth/unsubscribe?email=${encodeURIComponent(email)}>`,
      },
    });
  } catch (err) {
    console.error("[Email] Failed to send verification email to", email, err?.message || err);
    throw err;
  }
}

/**
 * Send a password reset link.
 */
async function sendPasswordResetEmail(email, token, name) {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const html = buildEmail({
    title: "Reset Your Password — Gotham Financial",
    preheader: "You requested a password reset for your Gotham Financial account.",
    greeting: `Hi ${name || "there"},`,
    body: `
      <p>We received a request to reset the password for your Gotham Financial account. Click the button below to choose a new password.</p>
      <p>This link will expire in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
      <div class="info-box">
        <div class="label">Security Notice</div>
        <p style="margin:0;font-size:13px;">If you did not request a password reset, your account may be at risk. Please review your account security settings immediately.</p>
      </div>
    `,
    ctaText: "Reset Password",
    ctaUrl: resetUrl,
    footer: `<p>If the button doesn't work, copy and paste this link:<br/><a href="${resetUrl}" style="word-break:break-all;">${resetUrl}</a></p>`,
  });

  try {
    return await deliver({
      from: EMAIL_FROM,
      to: email,
      subject: "Reset Your Password — Gotham Financial",
      text: `Hi ${name || "there"}, reset your password here: ${resetUrl} (expires in 1 hour)`,
      html,
      headers: {
        "X-Mailer": "Gotham-Financial/2.0",
        "X-Priority": "1",
        "List-Unsubscribe": `<${APP_URL}/api/auth/unsubscribe?email=${encodeURIComponent(email)}>`,
      },
    });
  } catch (err) {
    console.error("[Email] Failed to send password reset email to", email, err?.message || err);
    throw err;
  }
}

/**
 * Send an order confirmation after a trade is placed.
 */
async function sendOrderConfirmation(email, order) {
  const side = (order.side || "BUY").toUpperCase();
  const sideColor = side === "BUY" ? "#00c853" : "#ff1744";

  const html = buildEmail({
    title: "Order Confirmed — Gotham Financial",
    preheader: `Your ${side} order for ${order.symbol} has been placed.`,
    greeting: "Order Confirmation",
    body: `
      <p>Your order has been successfully placed on Gotham Financial.</p>
      <div class="info-box">
        <div class="label">Order Details</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Order ID</td>
            <td style="padding:6px 0;text-align:right;color:#e8edf2;font-family:'Courier New',monospace;font-size:13px;">${order.id || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Symbol</td>
            <td style="padding:6px 0;text-align:right;color:#e8edf2;font-weight:700;font-size:15px;">${order.symbol || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Side</td>
            <td style="padding:6px 0;text-align:right;color:${sideColor};font-weight:700;font-size:14px;">${side}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Quantity</td>
            <td style="padding:6px 0;text-align:right;color:#e8edf2;font-size:14px;">${order.quantity || 0}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Price</td>
            <td style="padding:6px 0;text-align:right;color:#00c853;font-weight:700;font-size:16px;">J$${(order.price || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Total Value</td>
            <td style="padding:6px 0;text-align:right;color:#ffd600;font-weight:700;font-size:16px;">J$${((order.price || 0) * (order.quantity || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Status</td>
            <td style="padding:6px 0;text-align:right;color:#00c853;font-weight:600;font-size:13px;text-transform:uppercase;">${order.status || "PENDING"}</td>
          </tr>
        </table>
      </div>
      <p style="font-size:13px;color:#6b7a8d;">
        <strong>Disclaimer:</strong> This is a paper trading order for educational purposes. No real securities were purchased or sold.
      </p>
    `,
    ctaText: "View My Orders",
    ctaUrl: `${APP_URL}/#transactions`,
  });

  try {
    return await deliver({
      from: EMAIL_FROM,
      to: email,
      subject: `Order Confirmed: ${side} ${order.quantity} ${order.symbol} — Gotham Financial`,
      text: `Your ${side} order for ${order.quantity} shares of ${order.symbol} at J$${order.price} has been placed.`,
      html,
      headers: {
        "X-Mailer": "Gotham-Financial/2.0",
        "List-Unsubscribe": `<${APP_URL}/api/auth/unsubscribe?email=${encodeURIComponent(email)}>`,
      },
    });
  } catch (err) {
    console.error("[Email] Failed to send order confirmation to", email, err?.message || err);
  }
}

/**
 * Send a welcome email after a user successfully verifies their account.
 */
async function sendWelcomeEmail(email, name) {
  const html = buildEmail({
    title: "Welcome to Gotham Financial",
    preheader: "Your account is ready. Start investing with AI-powered insights.",
    greeting: `Welcome aboard, ${name || "Investor"}!`,
    body: `
      <p>Your Gotham Financial account is now fully set up. Here's what you can do next:</p>
      <div class="info-box">
        <div class="label">Getting Started</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
          <tr>
            <td style="padding:8px 0;color:#00c853;font-weight:700;font-size:14px;width:28px;">1.</td>
            <td style="padding:8px 0;color:#e8edf2;font-size:14px;">Browse Caribbean market listings — JSE, TTSE, ECSE and more — in real-time</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#00c853;font-weight:700;font-size:14px;">2.</td>
            <td style="padding:8px 0;color:#e8edf2;font-size:14px;">Ask the AI advisor for personalised investment insights</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#00c853;font-weight:700;font-size:14px;">3.</td>
            <td style="padding:8px 0;color:#e8edf2;font-size:14px;">Practice with paper trading before investing real money</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#00c853;font-weight:700;font-size:14px;">4.</td>
            <td style="padding:8px 0;color:#e8edf2;font-size:14px;">Set price alerts so you never miss an opportunity</td>
          </tr>
        </table>
      </div>
    `,
    ctaText: "Go to Dashboard",
    ctaUrl: APP_URL,
    footer: `<p>Need help getting started? Reply to this email or use the AI chat inside the app.</p>`,
  });

  try {
    return await deliver({
      from: EMAIL_FROM,
      to: email,
      subject: "Welcome to Gotham Financial — Let's Get Started",
      text: `Welcome to Gotham Financial, ${name || "Investor"}! Your account is ready. Visit ${APP_URL} to get started.`,
      html,
      headers: {
        "X-Mailer": "Gotham-Financial/2.0",
        "List-Unsubscribe": `<${APP_URL}/api/auth/unsubscribe?email=${encodeURIComponent(email)}>`,
      },
    });
  } catch (err) {
    console.error("[Email] Failed to send welcome email to", email, err?.message || err);
  }
}

/**
 * Send a price alert notification when a user's alert triggers.
 */
async function sendAlertTriggered(email, alert) {
  const direction = alert.direction === "above" ? "risen above" : "fallen below";
  const dirColor = alert.direction === "above" ? "#00c853" : "#ff1744";

  const html = buildEmail({
    title: `Price Alert: ${alert.symbol} — Gotham Financial`,
    preheader: `${alert.symbol} has ${direction} J$${alert.targetPrice}`,
    greeting: "Price Alert Triggered",
    body: `
      <p>One of your price alerts has been triggered.</p>
      <div class="info-box">
        <div class="label">Alert Details</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Symbol</td>
            <td style="padding:6px 0;text-align:right;color:#e8edf2;font-weight:700;font-size:16px;">${alert.symbol}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Condition</td>
            <td style="padding:6px 0;text-align:right;color:${dirColor};font-weight:600;font-size:14px;">Price ${direction}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Target Price</td>
            <td style="padding:6px 0;text-align:right;color:#ffd600;font-weight:700;font-size:16px;">J$${(alert.targetPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Current Price</td>
            <td style="padding:6px 0;text-align:right;color:#00c853;font-weight:700;font-size:18px;">J$${(alert.currentPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Triggered At</td>
            <td style="padding:6px 0;text-align:right;color:#e8edf2;font-size:13px;">${new Date().toLocaleString("en-US", { timeZone: "America/Jamaica" })}</td>
          </tr>
        </table>
      </div>
      <p style="font-size:13px;color:#6b7a8d;">
        <strong>Disclaimer:</strong> This platform provides financial information for educational purposes only. It does not constitute financial advice. Always do your own research before making investment decisions.
      </p>
    `,
    ctaText: "View Stock Details",
    ctaUrl: `${APP_URL}/#stock/${alert.symbol}`,
  });

  try {
    return await deliver({
      from: EMAIL_FROM,
      to: email,
      subject: `Price Alert: ${alert.symbol} has ${direction} J$${alert.targetPrice}`,
      text: `${alert.symbol} has ${direction} your target of J$${alert.targetPrice}. Current price: J$${alert.currentPrice}.`,
      html,
      headers: {
        "X-Mailer": "Gotham-Financial/2.0",
        "List-Unsubscribe": `<${APP_URL}/api/auth/unsubscribe?email=${encodeURIComponent(email)}>`,
      },
    });
  } catch (err) {
    console.error("[Email] Failed to send price alert to", email, err?.message || err);
  }
}

/**
 * Notify the founder/admin whenever a new user signs up.
 */
async function sendSignupNotification(to, user) {
  if (!to) return;
  const when = new Date().toLocaleString("en-US", { timeZone: "America/Jamaica" });
  const html = buildEmail({
    title: "New Gotham Financial sign-up",
    preheader: `${user.name || "Someone"} just signed up.`,
    greeting: "New sign-up 🎉",
    body: `
      <p>A new user just created an account on Gotham Financial.</p>
      <div class="info-box">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
          <tr><td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Name</td><td style="padding:6px 0;text-align:right;color:#e8edf2;font-weight:700;font-size:14px;">${user.name || "—"}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Email</td><td style="padding:6px 0;text-align:right;color:#00c853;font-size:14px;">${user.email}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Plan</td><td style="padding:6px 0;text-align:right;color:#e8edf2;font-size:14px;">${user.plan || "FREE"}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7a8d;font-size:13px;">Time</td><td style="padding:6px 0;text-align:right;color:#e8edf2;font-size:13px;">${when}</td></tr>
        </table>
      </div>
    `,
  });
  try {
    return await deliver({
      from: EMAIL_FROM,
      to,
      subject: `New sign-up: ${user.name || user.email}`,
      text: `New Gotham Financial sign-up: ${user.name || ""} <${user.email}> at ${when}`,
      html,
    });
  } catch (err) {
    console.error("[Email] Failed to send signup notification:", err?.message || err);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Exports ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendSignupNotification,
  sendOrderConfirmation,
  sendAlertTriggered,
  codeFromToken,
};
