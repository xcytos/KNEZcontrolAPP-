import { Browser, Page, chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

let cached: { browser: Browser; page: Page } | null = null;

export async function connectTauri(): Promise<{ browser: Browser; page: Page }> {
  if (cached) return cached;

  const fallbackCdpUrl = () => {
    try {
      const statePath = path.resolve(process.cwd(), "tests", "tauri-e2e", ".tauri-dev-state.json");
      if (!fs.existsSync(statePath)) return null;
      const raw = fs.readFileSync(statePath, "utf8");
      const parsed = JSON.parse(raw);
      return typeof parsed?.cdpUrl === "string" ? parsed.cdpUrl : null;
    } catch {
      return null;
    }
  };
  const cdpUrl = process.env.TAURI_CDP_URL ?? fallbackCdpUrl() ?? "http://127.0.0.1:9222";
  let browser: Browser | null = null;
  let lastErr: any = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      browser = await chromium.connectOverCDP(cdpUrl);
      break;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!browser) throw lastErr ?? new Error("tauri_cdp_connect_failed");
  const contexts = browser.contexts();
  const pages = contexts.flatMap((c) => c.pages());
  const page =
    pages.find((p) => p.url().startsWith("http://localhost:5173/")) ??
    pages.find((p) => (p.title() || "").toLowerCase().includes("knez")) ??
    pages[0];
  if (!page) throw new Error("tauri_no_page");
  await page.waitForLoadState("domcontentloaded");
  cached = { browser, page };
  return cached;
}

export async function closeTauri() {
  const current = cached;
  cached = null;
  try {
    await current?.browser.close();
  } catch {}
}

export async function setKnezEndpoint(page: Page, endpoint: string) {
  await page.evaluate(
    ({ endpoint }) => {
      const profile = {
        id: "e2e-tauri",
        type: "local",
        transport: "http",
        endpoint,
        trustLevel: "untrusted",
      };
      localStorage.setItem("knez_connection_profile", JSON.stringify(profile));
      localStorage.removeItem("knez_session_id");
      try {
        indexedDB.deleteDatabase("KnezDatabase");
      } catch {}
    },
    { endpoint }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
}
