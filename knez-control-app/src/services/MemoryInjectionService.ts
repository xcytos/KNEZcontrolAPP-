import { mcpOrchestrator } from "../mcp/McpOrchestrator";
import { toolExposureService } from "./ToolExposureService";
import { governanceService } from "./GovernanceService";

type CompletionMessage = { role: string; content: string };

type MemorySnippet = {
  id: string;
  tags: string[];
  text: string;
};

function tokenize(s: string): Set<string> {
  const raw = String(s ?? "").toLowerCase();
  const out = new Set<string>();
  for (const part of raw.split(/[^a-z0-9_:-]+/g)) {
    const t = part.trim();
    if (t.length >= 3) out.add(t);
  }
  return out;
}

function scoreOverlap(queryTokens: Set<string>, snippetTokens: Set<string>): number {
  let score = 0;
  for (const t of snippetTokens) {
    if (queryTokens.has(t)) score++;
  }
  return score;
}

function stableHash(value: unknown): string {
  let raw = "";
  try {
    raw = JSON.stringify(value) ?? String(value);
  } catch {
    raw = String(value);
  }
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeoutId: number | undefined;
  const timeout = new Promise<T | null>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(null), Math.max(1, timeoutMs));
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (typeof timeoutId === "number") clearTimeout(timeoutId);
  }
}

export class MemoryInjectionService {
  private staticSnippets: MemorySnippet[] = [
    {
      id: "chat:tool_loop",
      tags: ["chat:tool_loop", "mcp:tools"],
      text:
        "Tool-call loop is authoritative: model may propose tool calls; orchestrator executes them; tool results are appended; model is re-invoked until no tool_call remains."
    },
    {
      id: "mcp:tool_protocol_strict",
      tags: ["mcp:tools", "mcp:protocol", "mcp:no_simulation"],
      text:
        'If a tool is required, reply ONLY with strict JSON and nothing else: {"tool_call":{"name":"serverId__toolName","arguments":{}}}. No markdown, no prose, no explanations, no simulation, no fake results. If you do not know the exact canonical tool name, do not guess—use the provided tool list.'
    },
    {
      id: "mcp:naming",
      tags: ["mcp:tools", "mcp:naming"],
      text:
        "Tool names must be canonical and namespaced as serverId__toolName. Never call tools by raw toolName."
    },
    {
      id: "mcp:errors",
      tags: ["mcp:errors", "governance:policy"],
      text:
        "All MCP tool failures must map to: mcp_not_started, mcp_not_ready, mcp_timeout, mcp_tool_not_found, mcp_permission_denied, mcp_tool_execution_error, mcp_process_crashed."
    },
    {
      id: "mcp:truth",
      tags: ["mcp:lifecycle", "ui:registry"],
      text:
        "Runtime truth > UI assumptions: never assume READY or tool availability without orchestrator verification. Never cache tool schemas as truth."
    }
  ];

  private staticTokenIndex = new Map<string, Set<string>>();

  constructor() {
    for (const snip of this.staticSnippets) {
      this.staticTokenIndex.set(snip.id, tokenize(`${snip.tags.join(" ")} ${snip.text}`));
    }
  }

  private buildRuntimeBlock(): { block: string; signature: string } {
    const snap = mcpOrchestrator.getSnapshot();
    const servers = Object.values(snap.servers);
    servers.sort((a, b) => a.serverId.localeCompare(b.serverId));
    const serverLines = servers.map((s) => {
      return `- ${s.serverId}: state=${s.state} running=${String(s.running)} pid=${String(s.pid ?? "null")} generation=${String(s.generation)} framing=${s.framing} tools_hash=${String(s.toolsHash ?? "null")} tools_cached=${s.tools.length}`;
    });
    const signatureInput = servers.map((s) => ({
      serverId: s.serverId,
      state: s.state,
      pid: s.pid ?? null,
      generation: s.generation,
      toolsHash: s.toolsHash ?? null,
    }));
    const signature = stableHash(signatureInput);

    const allowedTools = toolExposureService.getToolsForModel().slice(0, 80).map((t) => t.name);
    const toolsLine = allowedTools.length ? allowedTools.join(", ") : "(none)";

    const block =
      `[RUNTIME: MCP_SIGNATURE]\n` +
      `mcp_signature=${signature}\n\n` +
      "[RUNTIME: MCP_STATE]\n" +
      "Servers:\n" +
      (serverLines.length ? serverLines.join("\n") : "- (none)") +
      "\n\n" +
      "[RUNTIME: ACTIVE_TOOLS]\n" +
      toolsLine
    return { block, signature };
  }

  private async getGovernanceHash(): Promise<string | null> {
    const res = await withTimeout(governanceService.getSnapshot({ maxAgeMs: 2500 }), 650);
    const hash = (res as any)?.combinedSha256 ?? null;
    return typeof hash === "string" && hash ? hash : null;
  }

  async inject(
    messages: CompletionMessage[],
    opts: { sessionId: string; userText: string }
  ): Promise<{ messages: CompletionMessage[]; signature: string }> {
    const base = Array.isArray(messages) ? messages.slice() : [];
    const qTokens = tokenize(opts.userText);
    const ranked = this.staticSnippets
      .map((s) => ({ s, score: scoreOverlap(qTokens, this.staticTokenIndex.get(s.id) ?? new Set()) }))
      .sort((a, b) => b.score - a.score);
    const chosen = ranked.filter((r) => r.score > 0).slice(0, 2).map((r) => r.s);

    const governanceHash = await this.getGovernanceHash();
    const runtime = this.buildRuntimeBlock();
    const staticBlock = [this.staticSnippets[0], this.staticSnippets[1], this.staticSnippets[2], this.staticSnippets[3], ...chosen]
      .map((s) => `- ${s.text}`)
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
      .join("\n");

    const govLine = governanceHash ? `\n\n[RUNTIME: GOVERNANCE]\ncombined_sha256=${governanceHash}` : "";
    const content = `You are operating inside knez-control-app with MCP.\n\n[STATIC: RULES]\n${staticBlock}\n\n${runtime.block}${govLine}`;

    const systemMsg: CompletionMessage = { role: "system", content: content.slice(0, 8000) };
    return { messages: [systemMsg, ...base], signature: runtime.signature };
  }
}

export const memoryInjectionService = new MemoryInjectionService();
