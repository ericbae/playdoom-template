import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.CAPTURE_BASE_URL || "http://localhost:8787";
const outDir = "public/assets/map-shots";
const requested = process.argv.slice(2).map(normalizeMap).filter(Boolean);
const maps = requested.length ? requested : Array.from({ length: 32 }, (_, index) => String(index + 1).padStart(2, "0"));

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  for (const map of maps) {
    const out = `${outDir}/MAP${map}.png`;
    if (existsSync(out) && process.env.CAPTURE_FORCE !== "1") {
      console.log(`Skipping MAP${map}`);
      continue;
    }

    console.log(`Capturing MAP${map}`);
    await captureMap(browser, map, out);
  }
} finally {
  await browser.close();
}

async function captureMap(browser, map, out) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

  try {
    await page.goto(`${baseUrl}/?captureMap=${map}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.__doomPreviewReady === true, null, { timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.addStyleTag({
      content: "#game-panel,#status-stack{display:none!important}"
    });
    await page.locator("#canvas").screenshot({ path: out, timeout: 10000 });
  } finally {
    await page.close();
  }
}

function normalizeMap(value) {
  const match = String(value || "").match(/\d{1,2}/);
  if (!match) {
    return "";
  }

  const number = Number(match[0]);
  if (number < 1 || number > 32) {
    return "";
  }

  return String(number).padStart(2, "0");
}
