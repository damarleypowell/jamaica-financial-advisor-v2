require("dotenv").config();
const express = require("express");
const http    = require("http");
const path    = require("path");

const app      = express();
const PORT     = process.env.FRONTEND_PORT || 3001;
const API_PORT = process.env.PORT || 3000;

function proxyToApi(req, res) {
  const isSSE = req.headers.accept === "text/event-stream";

  const options = {
    hostname: "localhost",
    port: API_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${API_PORT}` },
  };

  const proxy = http.request(options, (proxyRes) => {
    // Copy status + headers
    res.writeHead(proxyRes.statusCode, proxyRes.headers);

    if (isSSE) {
      // Flush each chunk immediately — critical for SSE
      proxyRes.on("data", (chunk) => {
        res.write(chunk);
        if (res.flush) res.flush();
      });
      proxyRes.on("end", () => res.end());
    } else {
      proxyRes.pipe(res, { end: true });
    }
  });

  proxy.on("error", (err) => {
    console.error("[Proxy error]", err.message);
    if (!res.headersSent) res.status(502).json({ error: "API unavailable" });
  });

  req.pipe(proxy, { end: true });
}

app.use("/api",     proxyToApi);
app.use("/analyze", proxyToApi);
app.use("/health",  proxyToApi);

// Static frontend
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Gotham Financial UI  →  http://localhost:${PORT}`);
  console.log(`API proxy           →  http://localhost:${API_PORT}`);
});
