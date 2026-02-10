import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fallbackCdpUrl() {
  try {
    const statePath = path.resolve(process.cwd(), "tests", "tauri-e2e", ".tauri-dev-state.json");
    if (!fs.existsSync(statePath)) return null;
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed?.cdpUrl === "string" ? parsed.cdpUrl : null;
  } catch {
    return null;
  }
}

async function clickButtonByText(page, label, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await page.evaluate((label) => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => (b.textContent ?? "").trim() === label
      );
      if (!btn) return false;
      (btn).click();
      return true;
    }, label);
    if (ok) return;
    await sleep(250);
  }
  throw new Error(`button_not_found: ${label}`);
}

async function waitForTextContains(page, selector, needle, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      return el ? (el.textContent ?? "") : "";
    }, selector);
    if (String(text).includes(needle)) return;
    await sleep(250);
  }
  throw new Error(`timeout_waiting_for_text: selector=${selector} needle=${needle}`);
}

async function tryInvoke(page, command, args) {
  try {
    await page.evaluate(async ({ command, args }) => {
      const w = window;
      const invokeFn = w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke;
      if (!invokeFn) return;
      try {
        await invokeFn(command, args);
      } catch {}
    }, { command, args });
  } catch {}
}

async function main() {
  const cdpUrl = process.env.TAURI_CDP_URL ?? fallbackCdpUrl();
  if (!cdpUrl) throw new Error("missing TAURI_CDP_URL");

  const outDir = path.resolve(process.cwd(), "tests", "tauri-e2e", "puppeteer-artifacts");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.connect({ browserURL: cdpUrl });
  try {
    const pages = await browser.pages();
    const page = pages.find((p) => p.url().includes(":5173/")) ?? pages[0];
    if (!page) throw new Error("no_pages");

    page.on("console", (msg) => {
      const t = msg.type();
      const text = msg.text();
      if (t === "error" || t === "warning" || /\[(mcp|knez_client|taqwin|runtime)\]/i.test(text)) {
        process.stdout.write(`[PUPPETEER] console.${t}: ${text}\n`);
      }
    });

    await page.bringToFront();
    await sleep(150);

    await page.click('button[title="Chat"]');
    await page.waitForSelector('[title="TAQWIN Tools"]', { timeout: 30000 });
    await page.click('[title="TAQWIN Tools"]');

    await clickButtonByText(page, "MCP Config", 30000);
    await clickButtonByText(page, "Auto-detect", 30000);
    await clickButtonByText(page, "Save", 30000);

    await page.waitForSelector('[data-testid="mcp-control"]', { timeout: 30000 });
    await page.click('[data-testid="mcp-control"]');

    await waitForTextContains(page, '[data-testid="mcp-status"]', "mcp_state=READY", 60000);

    const snapPath = path.join(outDir, `puppeteer-${Date.now()}.png`);
    await page.screenshot({ path: snapPath });
    process.stdout.write(`[PUPPETEER] ok screenshot=${snapPath}\n`);

    await tryInvoke(page, "close_all_test_windows");
    await tryInvoke(page, "close_main_window");
  } finally {
    try {
      await browser.disconnect();
    } catch {}
  }
}

main().catch((e) => {
  process.stderr.write(`[PUPPETEER] FAIL ${String(e?.message ?? e)}\n`);
  process.exit(1);
});

