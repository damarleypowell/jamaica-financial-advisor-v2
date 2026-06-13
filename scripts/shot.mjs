// Mobile-first screenshot helper (puppeteer-core + local Chrome).
// Usage: node scripts/shot.mjs <state> <label> [width] [height]
//   state: home | login | signup | onboarding | <path like /learn>
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "..", "temporary screenshots");
import fs from "fs";
fs.mkdirSync(OUT_DIR, { recursive: true });

const CHROME =
  "C:/Users/damar/.cache/puppeteer/chrome/win64-146.0.7680.153/chrome-win64/chrome.exe";

const state = process.argv[2] || "home";
const label = process.argv[3] || state;
const width = parseInt(process.argv[4], 10) || 390;
const height = parseInt(process.argv[5], 10) || 844;
const BASE = "http://localhost:3001";

const clickByText = async (page, text) => {
  const handle = await page.evaluateHandle((t) => {
    const els = [...document.querySelectorAll("button, a")];
    return els.find((e) => e.textContent.trim().toLowerCase().includes(t.toLowerCase())) || null;
  }, text);
  const el = handle.asElement();
  if (el) { await el.click(); return true; }
  return false;
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height, isMobile: width < 768, deviceScaleFactor: 2 });

  // Seed localStorage to skip onboarding/tour where relevant.
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("gf_onboarded", "1");
    localStorage.setItem("gf_tour_v1", "done");
    localStorage.setItem("gf_tos", "1");
  });

  let url = BASE + "/";
  if (state.startsWith("/")) url = BASE + state;
  if (state === "onboarding") url = BASE + "/onboarding";

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch((e) => console.log("goto:", e.message));
  await new Promise((r) => setTimeout(r, 3200));
  console.log("final url:", page.url(), "| text:", await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 90)));

  if (state === "login" || state === "signup") {
    // Open the auth modal deterministically via the dev-exposed store.
    await page.evaluate((view) => {
      const ui = window.__ui;
      if (ui) ui.getState().openAuthModal(view);
    }, state);
    await new Promise((r) => setTimeout(r, 800));
  }

  // find next index
  const existing = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith("shot-"));
  const n = existing.length + 1;
  const file = path.join(OUT_DIR, `shot-${n}-${label}.png`);
  await page.screenshot({ path: file, fullPage: state.startsWith("/") || state === "onboarding" });
  console.log("saved", file);
  await browser.close();
})().catch((e) => { console.error("shot error:", e.message); process.exit(1); });
