require("dotenv").config();
const express = require("express");
const path    = require("path");

const app  = express();
const PORT = process.env.FRONTEND_PORT || 3001;

app.use(express.static(path.join(__dirname, "public")));

// Fallback to index.html for any unmatched route
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Jamaica Financial Advisor UI  →  http://localhost:${PORT}`);
  console.log(`Make sure the API server is running on http://localhost:3000`);
});
