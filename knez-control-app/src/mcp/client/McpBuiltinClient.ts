import { invoke } from "@tauri-apps/api/core";
import type { McpToolDefinition } from "../../services/McpTypes";
import type { McpTrafficEvent } from "../inspector/McpTraffic";
import { logger } from "../../services/LogService";

const BUILTIN_SERVER_INFO = {
  name: "tauri-ui",
  version: "1.0.0",
  protocolVersion: "2024-11-05",
};

const TOOLS: McpToolDefinition[] = [
  {
    name: "ui_navigate",
    description: "Navigate to a section of the KNEZ Control app by clicking a sidebar nav item",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description: "Section name to navigate to (e.g. 'Chat', 'MCP Registry', 'Settings', 'Agent Loop', 'Memory', 'Timeline')",
        },
      },
      required: ["section"],
    },
  },
  {
    name: "ui_click",
    description: "Click a DOM element inside the Tauri window by CSS selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the element to click" },
      },
      required: ["selector"],
    },
  },
  {
    name: "ui_fill",
    description: "Fill an input or textarea element with a value",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the input element" },
        value: { type: "string", description: "Value to fill" },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "ui_hover",
    description: "Hover over a DOM element to trigger hover/tooltip effects",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the element to hover" },
      },
      required: ["selector"],
    },
  },
  {
    name: "ui_select",
    description: "Select an option in a <select> element",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the select element" },
        value: { type: "string", description: "Option value to select" },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "ui_evaluate",
    description: "Execute arbitrary JavaScript in the Tauri WebView context and return the result",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "JavaScript code to execute" },
      },
      required: ["script"],
    },
  },
  {
    name: "ui_snapshot",
    description: "Take a snapshot of the current visible UI state — returns visible text, headings, and button labels",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Optional CSS selector to snapshot a specific region (defaults to entire page)",
        },
      },
    },
  },
];

async function execDomAction(action: string, selector?: string, value?: string, script?: string): Promise<string> {
  const isTauri = !!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__;
  if (isTauri) {
    try {
      const result = await invoke<string>("ui_action", { action, selector, value, script });
      return result ?? "ok";
    } catch (e: any) {
      logger.warn("tauri_ui_mcp", "invoke_ui_action_failed_fallback", { error: String(e?.message ?? e) });
    }
  }
  return execDomDirect(action, selector, value, script);
}

function execDomDirect(action: string, selector?: string, value?: string, script?: string): string {
  const sel = selector ?? "";
  const val = value ?? "";
  switch (action) {
    case "click": {
      const el = sel ? document.querySelector(sel) : null;
      if (!el) return `not_found:${sel}`;
      (el as HTMLElement).click();
      return "ok";
    }
    case "fill": {
      const el = sel ? document.querySelector(sel) : null;
      if (!el) return `not_found:${sel}`;
      (el as any).value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return "ok";
    }
    case "hover": {
      const el = sel ? document.querySelector(sel) : null;
      if (!el) return `not_found:${sel}`;
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      return "ok";
    }
    case "select": {
      const el = sel ? document.querySelector(sel) : null;
      if (!el) return `not_found:${sel}`;
      (el as HTMLSelectElement).value = val;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return "ok";
    }
    case "focus": {
      const el = sel ? document.querySelector(sel) : null;
      if (!el) return `not_found:${sel}`;
      (el as HTMLElement).focus();
      return "ok";
    }
    case "evaluate": {
      try {
        const result = (0, eval)(script ?? "");
        return String(result ?? "");
      } catch (e: any) {
        return `error:${e?.message ?? String(e)}`;
      }
    }
    default:
      return `unknown_action:${action}`;
  }
}

async function toolNavigate(args: Record<string, any>): Promise<string> {
  const section = String(args.section ?? "");
  const candidates = Array.from(document.querySelectorAll("button, a, li, nav *")).filter(
    (el) => (el as HTMLElement).offsetHeight > 0 && el.textContent?.trim() === section
  );
  if (candidates.length > 0) {
    (candidates[0] as HTMLElement).click();
    return `navigated to: ${section}`;
  }
  const partial = Array.from(document.querySelectorAll("button, a, li, nav *")).find(
    (el) => (el as HTMLElement).offsetHeight > 0 && el.textContent?.trim().includes(section)
  );
  if (partial) {
    (partial as HTMLElement).click();
    return `navigated to: ${partial.textContent?.trim()}`;
  }
  return `not_found: ${section}`;
}

function toolSnapshot(args: Record<string, any>): string {
  const root = args.selector ? document.querySelector(args.selector) : document.body;
  if (!root) return `not_found: ${args.selector}`;
  const headings = (Array.from(root.querySelectorAll("h1,h2,h3,h4")) as HTMLElement[]).map((el) => `[H] ${el.textContent?.trim()}`);
  const buttons = (Array.from(root.querySelectorAll("button")) as HTMLElement[]).filter((el) => el.offsetHeight > 0).map((el) => `[BTN] ${el.textContent?.trim()}`);
  const inputs = (Array.from(root.querySelectorAll("input,textarea,select")) as HTMLInputElement[]).filter((el) => el.offsetHeight > 0).map((el) => `[INPUT] ${el.placeholder || el.name || el.tagName}`);
  const text = (root as HTMLElement).innerText?.slice(0, 2000) ?? "";
  const parts = [...headings.slice(0, 10), ...buttons.slice(0, 20), ...inputs.slice(0, 10), "", text];
  return parts.join("\n").trim().slice(0, 4000);
}

export class McpBuiltinClient {
  private _running = false;
  private _lastError: string | null = null;
  private _traffic: McpTrafficEvent[] = [];

  async startWithConfig(_server: any): Promise<void> {
    this._running = true;
    this._lastError = null;
    logger.info("tauri_ui_mcp", "builtin_server_started", { tools: TOOLS.length });
  }

  async stop(): Promise<void> {
    this._running = false;
  }

  async request(method: string, params?: any, _opts?: any): Promise<any> {
    if (!this._running && method !== "initialize") throw new Error("mcp_not_started");
    switch (method) {
      case "initialize":
        this._running = true;
        return {
          protocolVersion: BUILTIN_SERVER_INFO.protocolVersion,
          serverInfo: { name: BUILTIN_SERVER_INFO.name, version: BUILTIN_SERVER_INFO.version },
          capabilities: { tools: {} },
        };
      case "notifications/initialized":
        return {};
      case "tools/list":
        return { tools: TOOLS };
      case "tools/call": {
        const name: string = params?.name ?? "";
        const args: Record<string, any> = params?.arguments ?? {};
        const startedAt = performance.now();
        this._traffic.push({ kind: "request", at: Date.now(), method: `tools/call:${name}`, id: String(Date.now()) } as any);
        try {
          const result = await this._executeTool(name, args);
          const durationMs = Math.round(performance.now() - startedAt);
          this._traffic.push({ kind: "response", at: Date.now(), method: `tools/call:${name}`, id: String(Date.now()) } as any);
          logger.info("tauri_ui_mcp", "tool_executed", { name, durationMs });
          return { content: [{ type: "text", text: result }], isError: false };
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          this._lastError = msg;
          this._traffic.push({ kind: "spawn_error", at: Date.now(), message: msg } as any);
          return { content: [{ type: "text", text: `error: ${msg}` }], isError: true };
        }
      }
      default:
        return {};
    }
  }

  private async _executeTool(name: string, args: Record<string, any>): Promise<string> {
    switch (name) {
      case "ui_navigate":
        return await toolNavigate(args);
      case "ui_click":
        return await execDomAction("click", args.selector);
      case "ui_fill":
        return await execDomAction("fill", args.selector, args.value);
      case "ui_hover":
        return await execDomAction("hover", args.selector);
      case "ui_select":
        return await execDomAction("select", args.selector, args.value);
      case "ui_evaluate":
        return await execDomAction("evaluate", undefined, undefined, args.script);
      case "ui_snapshot":
        return toolSnapshot(args);
      default:
        throw new Error(`unknown_tool:${name}`);
    }
  }

  async initialize(): Promise<any> {
    return await this.request("initialize");
  }

  async listTools(_opts?: any): Promise<McpToolDefinition[]> {
    return TOOLS;
  }

  async callTool(name: string, args: any, _opts?: any): Promise<any> {
    return await this.request("tools/call", { name, arguments: args ?? {} });
  }

  getDebugState() {
    return {
      running: this._running,
      pid: null,
      startedWith: { mode: "builtin" as const, programName: "tauri-ui" },
      requestFraming: "line" as const,
      lastExitCode: null,
      lastCloseTail: null,
      lastError: this._lastError,
      lastTimeout: null,
      lastWrite: null,
      stderrTail: null,
      stdoutTail: null,
    };
  }

  getTraffic(): McpTrafficEvent[] {
    return this._traffic.slice();
  }
}
