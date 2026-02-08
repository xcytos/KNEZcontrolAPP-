const DEFAULT_CDP_URL = "http://127.0.0.1:9222";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForJson(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out fetching ${url}`);
}

async function getPageTargetWs(cdpBaseUrl, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let targets;
    try {
      targets = await waitForJson(`${cdpBaseUrl}/json/list`, 2000);
    } catch {
      await sleep(250);
      continue;
    }
    const pages = Array.isArray(targets)
      ? targets.filter((t) => t && t.type === "page" && typeof t.webSocketDebuggerUrl === "string")
      : [];
    const preferredUrl = pages.find(
      (t) => typeof t.url === "string" && (t.url === "http://localhost:5173/" || t.url.startsWith("http://localhost:5173/"))
    );
    const preferredTitle = pages.find((t) => typeof t.title === "string" && t.title.toLowerCase().includes("knez"));
    const page = preferredTitle ?? preferredUrl ?? null;
    if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    await sleep(250);
  }
  throw new Error("Timed out waiting for a CDP page target");
}

function createCdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  const opened = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(null), { once: true });
    ws.addEventListener("error", () => reject(new Error("CDP websocket error")), { once: true });
  });

  ws.addEventListener("message", (evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }
    if (!msg || typeof msg.id !== "number") return;
    const handler = pending.get(msg.id);
    if (!handler) return;
    pending.delete(msg.id);
    if (msg.error) handler.reject(new Error(msg.error.message || "CDP error"));
    else handler.resolve(msg.result);
  });

  async function send(method, params) {
    await opened;
    const id = nextId++;
    const payload = { id, method, params };
    const p = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    ws.send(JSON.stringify(payload));
    return p;
  }

  async function evaluate(expression, timeoutMs = 60000) {
    let attempt = 0;
    while (attempt < 10) {
      attempt++;
      try {
        const result = await send("Runtime.evaluate", {
          expression,
          awaitPromise: true,
          returnByValue: true
        });
        const value = result?.result?.value;
        if (value && value.__tauri_e2e_timeout) throw new Error(value.message || "E2E timeout");
        return value;
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg.includes("Execution context was destroyed") || msg.includes("Cannot find context with specified id")) {
          await sleep(250);
          continue;
        }
        throw e;
      }
    }
    throw new Error("CDP evaluate failed after retries");
  }

  async function close() {
    try {
      ws.close();
    } catch {}
  }

  return { send, evaluate, close };
}

function esc(v) {
  return JSON.stringify(v);
}

export async function runTauriE2E() {
  const cdpBaseUrl = process.env.TAURI_CDP_URL ?? DEFAULT_CDP_URL;
  const wsUrl = await getPageTargetWs(cdpBaseUrl, 60000);
  const cdp = createCdpClient(wsUrl);
  try {
    await cdp.send("Runtime.enable", {});
    const pageInfo = await cdp.evaluate(
      `(async () => ({
        href: location.href,
        title: document.title,
        readyState: document.readyState,
        hasRoot: !!document.querySelector("#root"),
        hasSidebar: !!document.querySelector('button[title="Chat"]'),
        bodyTextLen: (document.body?.textContent || "").length
      }))()`
    );
    console.log("TAURI E2E: page", pageInfo);

    const waitVisible = async (selector, timeoutMs = 60000) =>
      cdp.evaluate(
        `(async () => {
          const sel = ${esc(selector)};
          const timeout = ${timeoutMs};
          const start = Date.now();
          const isVisible = (el) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };
          while (Date.now() - start < timeout) {
            const el = document.querySelector(sel);
            if (el && isVisible(el)) return true;
            await new Promise((r) => setTimeout(r, 100));
          }
          return { __tauri_e2e_timeout: true, message: "Element not visible: " + sel };
        })()`
      );

    const waitEnabled = async (selector, timeoutMs = 60000) =>
      cdp.evaluate(
        `(async () => {
          const sel = ${esc(selector)};
          const timeout = ${timeoutMs};
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const el = document.querySelector(sel);
            if (el && typeof el.disabled === "boolean" && el.disabled === false) return true;
            await new Promise((r) => setTimeout(r, 150));
          }
          return { __tauri_e2e_timeout: true, message: "Element not enabled: " + sel };
        })()`
      );

    const click = async (selector) => {
      const point = await cdp.evaluate(
        `(async () => {
          const sel = ${esc(selector)};
          const el = document.querySelector(sel);
          if (!el) throw new Error("Missing element: " + sel);
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`
      );
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
    };

    const domClick = async (selector) =>
      cdp.evaluate(
        `(async () => {
          const sel = ${esc(selector)};
          const el = document.querySelector(sel);
          if (!el) throw new Error("Missing element: " + sel);
          el.click();
          return true;
        })()`
      );

    const type = async (selector, text) =>
      cdp.evaluate(
        `(async () => {
          const sel = ${esc(selector)};
          const value = ${esc(text)};
          const el = document.querySelector(sel);
          if (!el) throw new Error("Missing element: " + sel);
          el.focus();
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const desc = Object.getOwnPropertyDescriptor(proto, "value");
          if (desc && typeof desc.set === "function") desc.set.call(el, value);
          else el.value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        })()`
      );

    const pressEnter = async (selector) =>
      cdp.evaluate(
        `(async () => {
          const sel = ${esc(selector)};
          const el = document.querySelector(sel);
          if (!el) throw new Error("Missing element: " + sel);
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
          el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
          return true;
        })()`
      );

    const submitChat = async () =>
      cdp.evaluate(
        `(async () => {
          const btn = document.querySelector('[data-testid="chat-send"]');
          if (!btn) throw new Error("Missing send button");
          if (btn.disabled) throw new Error("Send button disabled");
          btn.click();
          return true;
        })()`
      );

    const waitTextIncludes = async (selector, text, timeoutMs = 60000) =>
      cdp.evaluate(
        `(async () => {
          const sel = ${esc(selector)};
          const needle = ${esc(text)};
          const timeout = ${timeoutMs};
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const el = document.querySelector(sel);
            if (el && (el.textContent || "").includes(needle)) return true;
            await new Promise((r) => setTimeout(r, 100));
          }
          return { __tauri_e2e_timeout: true, message: "Text not found in " + sel + ": " + needle };
        })()`
      );

    const waitTextGone = async (text, timeoutMs = 60000) =>
      cdp.evaluate(
        `(async () => {
          const needle = ${esc(text)};
          const timeout = ${timeoutMs};
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const any = Array.from(document.querySelectorAll("*")).some((n) => (n.textContent || "").includes(needle));
            if (!any) return true;
            await new Promise((r) => setTimeout(r, 150));
          }
          return { __tauri_e2e_timeout: true, message: "Text still present: " + needle };
        })()`
      );

    await waitVisible("#root", 90000);

    const hasChatButton = await cdp.evaluate(
      `(async () => !!document.querySelector('button[title="Chat"]'))()`
    );
    if (hasChatButton) {
      try {
        await domClick('button[title="Chat"]');
      } catch {}
    }

    await waitVisible('[data-testid="chat-input"]', 60000);
    await waitEnabled('[data-testid="chat-input"]', 60000);

    await cdp.evaluate(
      `(async () => {
        const timeout = 30000;
        const start = Date.now();
        let last = "";
        let stable = 0;
        while (Date.now() - start < timeout) {
          const sid = localStorage.getItem("knez_session_id") || "";
          if (sid && sid === last) stable += 1;
          else stable = 0;
          last = sid;
          if (sid && stable >= 6) return true;
          await new Promise((r) => setTimeout(r, 200));
        }
        return { __tauri_e2e_timeout: true, message: "Session ID not stable" };
      })()`
    );

    await waitVisible('[data-testid="search-toggle"]', 60000);

    await type('[data-testid="chat-input"]', "tauri e2e: hello");
    await waitEnabled('[data-testid="chat-send"]', 15000);
    await submitChat();

    await waitTextIncludes("body", "tauri e2e: hello", 15000);
    const firstOutcome = await cdp.evaluate(
      `(async () => {
        const timeout = 60000;
        const start = Date.now();
        while (Date.now() - start < timeout) {
          const body = document.body?.textContent || "";
          if (body.includes("Stop")) return "stop";
          if (body.includes("Error:")) return "error";
          await new Promise((r) => setTimeout(r, 200));
        }
        return { __tauri_e2e_timeout: true, message: "No response state (Error/Stop) after send" };
      })()`
    );
    if (firstOutcome === "stop") {
      try {
        await domClick('button[title="Stop current response"]');
      } catch {}
      try {
        await waitTextGone("Stop", 10000);
      } catch {}
    }

    await domClick('button[title="New Session"]');
    await waitVisible('[data-testid="chat-input"]', 20000);
    await waitEnabled('[data-testid="chat-input"]', 20000);

    await type('[data-testid="chat-input"]', "tauri e2e: second session");
    await waitEnabled('[data-testid="chat-send"]', 15000);
    await submitChat();
    await waitTextIncludes("body", "tauri e2e: second session", 15000);

    await domClick('button[title="Session History"]');
    await waitTextIncludes("body", "Session History", 20000);

    await waitVisible("button", 20000);

    await sleep(250);
  } finally {
    await cdp.close();
  }
}
