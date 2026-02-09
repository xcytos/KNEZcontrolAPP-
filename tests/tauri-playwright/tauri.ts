import { Browser, Page, chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

let cached: { browser: Browser; page: Page; mode: "cdp" | "browser" } | null = null;
const pageLogBuffer = new WeakMap<Page, string[]>();
const openedLabels = new Set<string>();

async function withTimeout<T>(p: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeout = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(label)), Math.max(1, timeoutMs));
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function invokeTauri<T = any>(page: Page, command: string, args?: any): Promise<T> {
  if (cached?.mode === "browser") throw new Error("tauri_invoke_unavailable");
  return await page.evaluate(
    async ({ command, args }) => {
      const w: any = window as any;
      const invokeFn = w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke;
      if (!invokeFn) throw new Error("tauri_invoke_unavailable");
      return await invokeFn(command, args);
    },
    { command, args }
  );
}

function attachPageDiagnostics(page: Page, label: string) {
  if (pageLogBuffer.has(page)) return;
  pageLogBuffer.set(page, []);
  const push = (line: string) => {
    const buf = pageLogBuffer.get(page);
    if (!buf) return;
    buf.push(line);
    if (buf.length > 200) buf.splice(0, buf.length - 200);
  };
  page.on("console", (msg) => {
    const t = msg.type();
    const text = msg.text();
    const important =
      t === "error" ||
      t === "warning" ||
      /\[(mcp|knez_client|taqwin|runtime)\]/i.test(text) ||
      /\b(mcp_request_timeout|stdin_write|shell\.execute not allowed|permission)\b/i.test(text);
    if (!important) return;
    const line = `[E2E:${label}] console.${t}: ${text}`;
    push(line);
    console.log(line);
  });
  page.on("pageerror", (err) => {
    const line = `[E2E:${label}] pageerror: ${String((err as any)?.message ?? err)}`;
    push(line);
    console.log(line);
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure();
    if (!failure) return;
    const line = `[E2E:${label}] requestfailed: ${req.url()} (${failure.errorText})`;
    push(line);
    console.log(line);
  });
}

export function getPageDiagnostics(page: Page): string[] {
  return pageLogBuffer.get(page)?.slice() ?? [];
}

export async function connectTauri(): Promise<{ browser: Browser; page: Page }> {
  if (cached && !cached.page.isClosed()) return cached;
  cached = null;

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
  if (!browser) {
    const baseUrl = process.env.VITE_URL ?? "http://127.0.0.1:5173/";
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    console.log(`[E2E] CDP unavailable; using headless browser at ${baseUrl}`);
    cached = { browser, page, mode: "browser" };
    return cached;
  }
  console.log(`[E2E] Connected via CDP ${cdpUrl}`);
  const contexts = browser.contexts();
  const pages = contexts.flatMap((c) => c.pages()).filter((p) => !p.isClosed());
  const isTauriPage = async (p: Page): Promise<boolean> => {
    try {
      return await withTimeout(
        p.evaluate(() => {
          const w: any = window as any;
          return !!(w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke ?? w.__TAURI_INTERNALS__ ?? w.__TAURI_IPC__);
        }),
        1500,
        "e2e_is_tauri_page_timeout"
      );
    } catch {
      return false;
    }
  };
  let page: Page | undefined;
  const candidates = pages.filter((p) => p.url().includes(":5173/"));
  console.log(`[E2E] CDP pages total=${pages.length} candidates5173=${candidates.length}`);
  for (const p of candidates) {
    const url = p.url();
    const ok = await isTauriPage(p);
    console.log(`[E2E] page url=${url} tauri=${ok}`);
    if (ok) {
      page = p;
      break;
    }
  }
  if (!page) {
    page =
      pages.find((p) => p.url().startsWith("http://127.0.0.1:5173/") && !p.url().includes("e2e=1")) ??
      pages.find((p) => p.url().startsWith("http://localhost:5173/") && !p.url().includes("e2e=1")) ??
      pages.find((p) => p.url().includes(":5173/") && !p.url().includes("e2e=1")) ??
      pages.find((p) => !p.url().includes("playwright-report")) ??
      pages.find((p) => (p.title() || "").toLowerCase().includes("knez")) ??
      pages[0];
  }
  if (!page) throw new Error("tauri_no_page");
  await page.waitForLoadState("domcontentloaded");
  attachPageDiagnostics(page, "main");
  cached = { browser, page, mode: "cdp" };
  return cached;
}

export async function closeTauri() {
  const current = cached;
  cached = null;
  try {
    if (current?.browser) await withTimeout(current.browser.close(), 8000, "e2e_close_browser_timeout");
  } catch {}
}

export async function openE2EWindow(): Promise<{ page: Page; label: string }> {
  const { browser, page: main } = await connectTauri();
  if (cached?.mode === "cdp") {
    try {
      const contexts = browser.contexts();
      const pages = contexts.flatMap((c) => c.pages()).filter((p) => !p.isClosed());
      if (pages.length <= 1) {
        console.log(`[E2E] Single CDP target; using main window url=${main.url()}`);
        return { page: main, label: "main" };
      }
    } catch {}
  }
  try {
    if (!main.isClosed()) {
      try {
        await withTimeout(
          main.waitForFunction(() => {
            const w: any = window as any;
            return !!(w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke);
          }),
          15000,
          "e2e_wait_for_tauri_invoke_timeout"
        );
      } catch {}
    }
    const label = await invokeTauri<string>(main, "open_test_window");
    openedLabels.add(label);
    let target: Page | null = null;
    for (let attempt = 0; attempt < 80; attempt++) {
      const contexts = browser.contexts();
      const pages = contexts.flatMap((c) => c.pages()).filter((p) => !p.isClosed());
      target = pages.find((p) => p.url().includes(`label=${label}`)) ?? null;
      if (target) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!target) throw new Error("tauri_test_window_not_found");
    await target.waitForLoadState("domcontentloaded");
    attachPageDiagnostics(target, label);
    console.log(`[E2E] Opened test window label=${label} url=${target.url()}`);
    return { page: target, label };
  } catch (e) {
    console.log(`[E2E] open_test_window failed; using main. error=${String((e as any)?.message ?? e)}`);
    console.log(`[E2E] Falling back to main window url=${main.url()}`);
    return { page: main, label: "main" };
  }
}

export async function closeE2EWindow(label: string): Promise<void> {
  if (!label || label === "main") return;
  openedLabels.delete(label);
  try {
    const { page } = await connectTauri();
    await withTimeout(invokeTauri(page, "close_window", { label }), 5000, "e2e_close_window_timeout");
  } catch {}
}

export async function closeAllE2EWindows(): Promise<void> {
  try {
    const { page } = await connectTauri();
    await withTimeout(invokeTauri(page, "close_all_test_windows"), 5000, "e2e_close_all_windows_timeout");
  } catch {}
  openedLabels.clear();
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
