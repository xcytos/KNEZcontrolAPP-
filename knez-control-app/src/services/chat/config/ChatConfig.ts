// ─── ChatConfig.ts ─────────────────────────────────────────────────────
// Extracted from ChatService.ts - Phase 1 Week 2
// Responsibilities: MCP configuration, tool settings, search provider management
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "../../utils/LogService";
import { selectPrimaryBackend } from "../../../utils/health";

export interface ChatConfigCallbacks {
  onSearchProviderChanged: (provider: string) => void;
  onToolsChanged: (tools: { search: boolean }) => void;
  notify: () => void;
}

export interface ChatConfigState {
  activeTools: { search: boolean };
  searchProvider: string;
}

export class ChatConfig {
  private state: ChatConfigState;
  private sessionId: string | null = null;
  private callbacks: ChatConfigCallbacks;

  constructor(callbacks: ChatConfigCallbacks, initialState: ChatConfigState = { activeTools: { search: false }, searchProvider: "off" }) {
    this.callbacks = callbacks;
    this.state = { ...initialState };
  }

  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  // ─── MCP Configuration ─────────────────────────────────────────────────

  static isMcpEnabled(): boolean {
    try {
      const stored = localStorage.getItem("knez_mcp_enabled");
      if (stored === null) return true; // Default enabled
      return stored === "0" ? false : true;
    } catch { return true; }
  }

  static setMcpEnabled(enabled: boolean): void {
    try { localStorage.setItem("knez_mcp_enabled", enabled ? "1" : "0"); } catch {}
  }

  // ─── Tool Configuration ────────────────────────────────────────────────

  getActiveTools(): { search: boolean } {
    return { ...this.state.activeTools };
  }

  setActiveTools(tools: { search: boolean }): void {
    this.state.activeTools = tools;
    this.persistSearchEnabled(tools.search);
    void this.updateSearchProvider(tools.search);
    this.callbacks.onToolsChanged(tools);
    this.callbacks.notify();
  }

  private persistSearchEnabled(enabled: boolean): void {
    if (this.sessionId) {
      localStorage.setItem(`chat_search_enabled:${this.sessionId}`, enabled ? "1" : "0");
    }
  }

  loadSearchEnabled(sessionId: string): boolean {
    const stored = localStorage.getItem(`chat_search_enabled:${sessionId}`);
    return stored === "1";
  }

  // ─── Search Provider Management ──────────────────────────────────────────

  private async updateSearchProvider(searchEnabled: boolean): Promise<void> {
    const provider = await this.resolveSearchProvider(searchEnabled);
    this.state.searchProvider = provider;
    this.callbacks.onSearchProviderChanged(provider);
    this.callbacks.notify();
  }

  private async resolveSearchProvider(searchEnabled: boolean): Promise<string> {
    if (!searchEnabled) return "off";
    try {
      // Import knezClient dynamically to avoid circular dependency
      const { knezClient } = await import("../../knez/KnezClient");
      const health = await knezClient.health({ timeoutMs: 1500 });
      const backend = selectPrimaryBackend((health as any)?.backends);
      return backend?.model_id ?? "local";
    } catch (e) {
      logger.warn("chat_config", "search_provider_resolution_failed", { error: String(e) });
      return "local";
    }
  }

  getSearchProvider(): string {
    return this.state.searchProvider;
  }

  // ─── State Access ─────────────────────────────────────────────────────

  getState(): ChatConfigState {
    return { ...this.state };
  }

  setState(state: Partial<ChatConfigState>): void {
    if (state.activeTools) this.state.activeTools = state.activeTools;
    if (state.searchProvider) this.state.searchProvider = state.searchProvider;
  }
}
