const { Router } = require("express");
const router = Router();

const API_DOCS = {
  openapi: "3.0.3",
  info: {
    title: "JSE Live Trading Platform API",
    version: "2.0.0",
    description: "AI-powered Jamaica Stock Exchange Investment & Trading Platform",
    contact: { name: "JSE Live Support" },
  },
  servers: [
    { url: "http://localhost:3000", description: "Development" },
  ],
  tags: [
    { name: "Auth", description: "Authentication & user management" },
    { name: "Market", description: "Stock data & market info" },
    { name: "Trading", description: "Order placement & portfolio" },
    { name: "Analytics", description: "Technical analysis & ML" },
    { name: "AI", description: "AI chat & financial planning" },
    { name: "US Stocks", description: "Alpaca Markets integration" },
    { name: "Alerts", description: "Price alerts & notifications" },
    { name: "Payments", description: "Stripe deposits & withdrawals" },
    { name: "KYC", description: "Identity verification" },
    { name: "Subscription", description: "Plan management" },
    { name: "Admin", description: "Platform administration" },
  ],
  paths: {
    "/api/auth/signup": {
      post: { tags: ["Auth"], summary: "Register new account", requestBody: { content: { "application/json": { schema: { type: "object", required: ["name", "email", "password"], properties: { name: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", minLength: 6 } } } } } }, responses: { "200": { description: "JWT token + user object" }, "409": { description: "Email exists" } } },
    },
    "/api/auth/login": {
      post: { tags: ["Auth"], summary: "Sign in", requestBody: { content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" }, twoFactorToken: { type: "string", description: "6-digit TOTP code (if 2FA enabled)" } } } } } }, responses: { "200": { description: "JWT token or requires2FA flag" } } },
    },
    "/api/auth/me": {
      get: { tags: ["Auth"], summary: "Get current user profile", security: [{ bearerAuth: [] }], responses: { "200": { description: "User profile with portfolio, watchlist, goals" } } },
    },
    "/api/auth/2fa/setup": {
      post: { tags: ["Auth"], summary: "Generate 2FA secret", security: [{ bearerAuth: [] }], responses: { "200": { description: "TOTP secret + otpauth URL for QR code" } } },
    },
    "/api/auth/2fa/verify": {
      post: { tags: ["Auth"], summary: "Enable 2FA with verification code", security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { type: "object", required: ["token"], properties: { token: { type: "string", pattern: "^[0-9]{6}$" } } } } } }, responses: { "200": { description: "2FA enabled" } } },
    },
    "/api/auth/logout": {
      post: { tags: ["Auth"], summary: "Sign out (revoke session)", security: [{ bearerAuth: [] }], responses: { "200": { description: "Logged out" } } },
    },
    "/api/auth/reset-password": {
      post: { tags: ["Auth"], summary: "Request or complete password reset", requestBody: { content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" }, token: { type: "string" }, newPassword: { type: "string" } } } } } } },
    },
    "/api/auth/verify-email": {
      post: { tags: ["Auth"], summary: "Request or verify email", requestBody: { content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" }, token: { type: "string" } } } } } } },
    },
    "/api/stocks": {
      get: { tags: ["Market"], summary: "Get all JSE stocks with live prices", responses: { "200": { description: "Array of stocks" } } },
    },
    "/api/stocks/{symbol}": {
      get: { tags: ["Market"], summary: "Get single stock detail", parameters: [{ name: "symbol", in: "path", required: true, schema: { type: "string" } }] },
    },
    "/api/market-overview": {
      get: { tags: ["Market"], summary: "Market summary (index, volume, gainers/losers)" },
    },
    "/api/stream/prices": {
      get: { tags: ["Market"], summary: "SSE stream of real-time price updates" },
    },
    "/api/news": {
      get: { tags: ["Market"], summary: "Latest financial news" },
    },
    "/api/screener": {
      post: { tags: ["Market"], summary: "Screen stocks by criteria" },
    },
    "/api/orders": {
      post: { tags: ["Trading"], summary: "Place a trade order", security: [{ bearerAuth: [] }], requestBody: { content: { "application/json": { schema: { type: "object", required: ["symbol", "side", "quantity"], properties: { symbol: { type: "string" }, side: { type: "string", enum: ["BUY", "SELL"] }, orderType: { type: "string", enum: ["MARKET", "LIMIT", "STOP", "STOP_LIMIT"] }, quantity: { type: "number" }, limitPrice: { type: "number" }, stopPrice: { type: "number" } } } } } } },
      get: { tags: ["Trading"], summary: "List user's orders", security: [{ bearerAuth: [] }] },
    },
    "/api/orders/{id}": {
      delete: { tags: ["Trading"], summary: "Cancel an order", security: [{ bearerAuth: [] }] },
    },
    "/api/portfolio/positions": {
      get: { tags: ["Trading"], summary: "Get portfolio positions", security: [{ bearerAuth: [] }] },
    },
    "/api/wallet/balance": {
      get: { tags: ["Trading"], summary: "Get wallet balances (JMD + USD)", security: [{ bearerAuth: [] }] },
    },
    "/api/wallet/deposit": {
      post: { tags: ["Trading"], summary: "Deposit to wallet (paper trading)", security: [{ bearerAuth: [] }] },
    },
    "/api/analytics/technical/{symbol}": {
      get: { tags: ["Analytics"], summary: "Technical analysis (RSI, MACD, Bollinger, etc.)", parameters: [{ name: "symbol", in: "path", required: true, schema: { type: "string" } }] },
    },
    "/api/analytics/predict/{symbol}": {
      get: { tags: ["Analytics"], summary: "ML price prediction (requires Python service)", parameters: [{ name: "symbol", in: "path", required: true, schema: { type: "string" } }] },
    },
    "/api/analytics/backtest": {
      post: { tags: ["Analytics"], summary: "Backtest trading strategy" },
    },
    "/api/analytics/compound-growth": {
      post: { tags: ["Analytics"], summary: "Compound interest calculator" },
    },
    "/api/analytics/retirement": {
      post: { tags: ["Analytics"], summary: "Retirement planner calculator" },
    },
    "/api/analytics/loan": {
      post: { tags: ["Analytics"], summary: "Loan/mortgage calculator" },
    },
    "/api/chat": {
      post: { tags: ["AI"], summary: "Chat with AI financial advisor", requestBody: { content: { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { type: "string" }, symbol: { type: "string" }, level: { type: "string", enum: ["Beginner", "Intermediate", "Advanced"] } } } } } } },
    },
    "/api/financial-plan": {
      post: { tags: ["AI"], summary: "Generate AI financial plan" },
    },
    "/api/us/quote/{symbol}": {
      get: { tags: ["US Stocks"], summary: "Get US stock real-time quote", parameters: [{ name: "symbol", in: "path", required: true, schema: { type: "string" } }] },
    },
    "/api/us/orders": {
      post: { tags: ["US Stocks"], summary: "Place US stock order via Alpaca" },
      get: { tags: ["US Stocks"], summary: "List US stock orders" },
    },
    "/api/alerts": {
      post: { tags: ["Alerts"], summary: "Create price alert", security: [{ bearerAuth: [] }] },
      get: { tags: ["Alerts"], summary: "List price alerts", security: [{ bearerAuth: [] }] },
    },
    "/api/notifications": {
      get: { tags: ["Alerts"], summary: "Get unread notifications", security: [{ bearerAuth: [] }] },
    },
    "/api/payments/create-checkout": {
      post: { tags: ["Payments"], summary: "Create Stripe checkout for deposit", security: [{ bearerAuth: [] }] },
    },
    "/api/payments/create-withdrawal": {
      post: { tags: ["Payments"], summary: "Request withdrawal (KYC required)", security: [{ bearerAuth: [] }] },
    },
    "/api/kyc/status": {
      get: { tags: ["KYC"], summary: "Get KYC verification status", security: [{ bearerAuth: [] }] },
    },
    "/api/kyc/submit": {
      post: { tags: ["KYC"], summary: "Submit KYC documents", security: [{ bearerAuth: [] }] },
    },
    "/api/subscription": {
      get: { tags: ["Subscription"], summary: "Get current plan & usage", security: [{ bearerAuth: [] }] },
    },
    "/api/subscription/plans": {
      get: { tags: ["Subscription"], summary: "List available plans (public)" },
    },
    "/api/subscription/upgrade": {
      post: { tags: ["Subscription"], summary: "Upgrade subscription plan", security: [{ bearerAuth: [] }] },
    },
    "/api/admin/dashboard": {
      get: { tags: ["Admin"], summary: "Admin metrics overview", security: [{ bearerAuth: [] }] },
    },
    "/api/admin/users": {
      get: { tags: ["Admin"], summary: "List users (paginated)", security: [{ bearerAuth: [] }] },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
};

// Serve OpenAPI JSON
router.get("/api/docs/openapi.json", (_req, res) => {
  res.json(API_DOCS);
});

// Serve Swagger UI
router.get("/api/docs", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>JSE Live API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>body{margin:0;background:#1a1a2e;} .swagger-ui .topbar{display:none;}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({url:'/api/docs/openapi.json',dom_id:'#swagger-ui',deepLinking:true,presets:[SwaggerUIBundle.presets.apis],layout:'BaseLayout'});</script>
</body>
</html>`);
});

module.exports = router;
