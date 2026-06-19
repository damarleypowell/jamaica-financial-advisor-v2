// ══════════════════════════════════════════════════════════════════════════════
// ── Oros — Firewall & Rate Limiting ───────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const { rateLimit } = require('express-rate-limit');

// Best-effort security logging. Lazily resolved to dodge the circular dependency
// (admin.routes ⇄ firewall) and the fact that `module.exports = router` in
// admin.routes can momentarily hide this export. Never let logging crash a request.
function pushSecurityEvent(evt) {
  try {
    const fn = require('../routes/admin.routes').pushSecurityEvent;
    if (typeof fn === 'function') fn(evt?.type || 'event', evt, evt?.severity || 'medium');
  } catch (_) { /* logging is non-critical */ }
}

// ── Blocked IP set (runtime, synced with admin panel) ────────────────────────
const blockedIPs = new Set();

function getClientIP(req) {
  return (
    req.headers['cf-connecting-ip'] ||        // Cloudflare
    req.headers['x-real-ip'] ||               // Nginx
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

// ── IP block middleware ───────────────────────────────────────────────────────
function ipBlockMiddleware(req, res, next) {
  const ip = getClientIP(req);
  if (blockedIPs.has(ip)) {
    pushSecurityEvent({ type: 'blocked_ip_request', ip, path: req.path, method: req.method });
    return res.status(403).json({ error: 'Forbidden' });
  }
  req.clientIP = ip;
  next();
}

// ── General rate limit: 200 req/15min per IP ─────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    pushSecurityEvent({ type: 'rate_limit_general', ip: getClientIP(req), path: req.path });
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
  },
});

// ── Auth rate limit: 10 req/15min per IP (brute-force protection) ─────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    pushSecurityEvent({ type: 'rate_limit_auth', ip: getClientIP(req), path: req.path });
    res.status(429).json({ error: 'Too many auth attempts. Try again in 15 minutes.' });
  },
});

// ── Admin rate limit: 60 req/15min ───────────────────────────────────────────
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    pushSecurityEvent({ type: 'rate_limit_admin', ip: getClientIP(req), path: req.path });
    res.status(429).json({ error: 'Too many admin requests.' });
  },
});

// ── AI rate limit: 20 req/hour (expensive endpoints) ─────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    pushSecurityEvent({ type: 'rate_limit_ai', ip: getClientIP(req), path: req.path });
    res.status(429).json({ error: 'AI request limit reached. Try again in an hour.' });
  },
});

// ── Honeypot routes — common attack paths ─────────────────────────────────────
// Registers trap routes that no real user should ever hit.
// Any request to these paths gets logged and the IP auto-blocked.
const HONEYPOT_PATHS = [
  '/wp-admin', '/wp-login.php', '/xmlrpc.php',          // WordPress attacks
  '/.env', '/.git/config', '/.git/HEAD',                // Credential leaks
  '/phpmyadmin', '/admin/config.php', '/config.php',    // PHP probing
  '/etc/passwd', '/etc/shadow',                         // Unix file inclusion
  '/shell', '/cmd', '/exec',                            // RCE probing
  '/actuator/env', '/actuator/heapdump',                // Spring Boot
  '/api/v1/pods', '/api/v1/secrets',                    // Kubernetes
  '/console', '/manager/html', '/jmx-console',          // JBoss/Tomcat
];

function honeypotMiddleware(req, res, next) {
  const path = req.path.toLowerCase();
  const matched = HONEYPOT_PATHS.some(p => path.startsWith(p));
  if (matched) {
    const ip = getClientIP(req);
    blockedIPs.add(ip);
    pushSecurityEvent({
      type: 'honeypot_triggered',
      ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'] || 'unknown',
    });
    // Return a believable fake 404 — don't reveal it's a honeypot
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

// ── Suspicious header detection ───────────────────────────────────────────────
const SUSPICIOUS_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zgrab/i,
  /dirbuster/i, /burpsuite/i, /havij/i, /acunetix/i, /nessus/i,
];

function suspiciousRequestDetector(req, res, next) {
  const ua = req.headers['user-agent'] || '';
  const isSuspicious = SUSPICIOUS_UA_PATTERNS.some(p => p.test(ua));
  if (isSuspicious) {
    const ip = getClientIP(req);
    pushSecurityEvent({ type: 'suspicious_scanner', ip, path: req.path, userAgent: ua });
    blockedIPs.add(ip);
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// ── Export block/unblock functions for admin panel ───────────────────────────
function blockIP(ip) { blockedIPs.add(ip); }
function unblockIP(ip) { blockedIPs.delete(ip); }
function getBlockedIPs() { return [...blockedIPs]; }

module.exports = {
  ipBlockMiddleware,
  generalLimiter,
  authLimiter,
  adminLimiter,
  aiLimiter,
  honeypotMiddleware,
  suspiciousRequestDetector,
  blockIP,
  unblockIP,
  getBlockedIPs,
};
