import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function fallbackCdpUrl(): string | null {
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

async function tryInvoke(page: any, command: string, args?: any): Promise<void> {
  try {
    await page.evaluate(
      async ({ command, args }) => {
        const w: any = window as any;
        const invokeFn = w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke;
        if (!invokeFn) return;
        try {
          await invokeFn(command, args);
        } catch {}
      },
      { command, args }
    );
  } catch {}
}

export default async function globalTeardown() {
  const cdpUrl = process.env.TAURI_CDP_URL ?? fallbackCdpUrl();
  if (!cdpUrl) return;
  let browser: any = null;
  try {
    browser = await chromium.connectOverCDP(cdpUrl);
    const pages = browser.contexts().flatMap((c: any) => c.pages()).filter((p: any) => !p.isClosed());
    const page = pages.find((p: any) => p.url().includes(":5173/")) ?? pages[0] ?? null;
    if (page) {
      await tryInvoke(page, "close_all_test_windows");
      await tryInvoke(page, "close_main_window");
    }
  } catch {
  } finally {
    try {
      await browser?.close();
    } catch {}
  }
}

