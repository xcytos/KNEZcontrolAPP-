import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMcpInspector } from "./useMcpInspector";
import type { McpTrafficEvent } from "../../../mcp/inspector/McpTraffic";

type LogTab = "traffic" | "stdout" | "stderr" | "parse";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return String(ts);
  }
}

function asText(evt: McpTrafficEvent): string {
  if (evt.kind === "raw_stdout") return evt.text;
  if (evt.kind === "raw_stderr") return evt.text;
  if (evt.kind === "parse_error") return `${evt.detail}\n${evt.preview}`;
  if (evt.kind === "request") return JSON.stringify(evt.json, null, 2);
  if (evt.kind === "response") return JSON.stringify(evt.json, null, 2);
  if (evt.kind === "process_closed") return `[process_closed] code=${String(evt.code)}`;
  if (evt.kind === "spawn_error") return `[spawn_error] ${evt.message}`;
  return "";
}

function maskHeaderValue(name: string, value: string): string {
  const k = String(name ?? "").toLowerCase();
  const v = String(value ?? "");
  if (k === "authorization" || k.endsWith("-authorization")) return "Bearer …";
  if (/\$\{input:[^}]+\}/.test(v)) return v;
  if (v.length <= 64) return v;
  return `${v.slice(0, 16)}…`;
}

export const McpInspectorPanel: React.FC = () => {
  const svc = useMcpInspector();
  const cfg = svc.getConfig();
  const servers = svc.getServers();
  const statusById = svc.getStatusById();
  const selectedId = svc.getSelectedId();
  const selected = selectedId ? statusById[selectedId] : null;
  const isTauri = isTauriRuntime();
  const knez = svc.getKnezHealth();
  const knezNeeded =
    !!selected &&
    (selected.id === "taqwin" ||
      (selected.type === "stdio" &&
        (!!(selected.env as any)?.TAQWIN_GOVERNANCE_SNAPSHOT_URL || !!(selected.env as any)?.KNEZ_ENDPOINT)));

  const [rawDraft, setRawDraft] = useState(cfg.raw);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [toolSearch, setToolSearch] = useState("");
  const [toolArgsText, setToolArgsText] = useState("{}");
  const [toolTimeoutMs, setToolTimeoutMs] = useState(180000);
  const [toolResult, setToolResult] = useState<string>("");
  const [toolError, setToolError] = useState<string>("");
  const [logTab, setLogTab] = useState<LogTab>("traffic");
  const [trafficLimit, setTrafficLimit] = useState(300);
  const [checkingKnez, setCheckingKnez] = useState(false);
  const [toolsListTimeoutMs, setToolsListTimeoutMs] = useState(60000);
  const [logSearch, setLogSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const logsRef = useRef<HTMLDivElement | null>(null);
  const [showAddServer, setShowAddServer] = useState(false);
  const [addServerText, setAddServerText] = useState("");
  const [addServerError, setAddServerError] = useState<string>("");
  const [inputDrafts, setInputDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    void svc.loadConfig();
  }, []);

  useEffect(() => {
    setRawDraft(cfg.raw);
  }, [cfg.raw]);

  const tools = useMemo(() => {
    if (!selectedId) return [];
    const list = svc.getTools(selectedId);
    const q = toolSearch.trim().toLowerCase();
    const filtered = q ? list.filter((t) => t.name.toLowerCase().includes(q) || String(t.description ?? "").toLowerCase().includes(q)) : list;
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [selectedId, toolSearch, servers.length, Object.keys(statusById).join("|"), selected?.toolsCached]);

  useEffect(() => {
    if (!selectedId) return;
    const list = svc.getTools(selectedId);
    if (!selectedTool || !list.some((t) => t.name === selectedTool)) {
      setSelectedTool(list[0]?.name ?? "");
    }
  }, [selectedId, tools.length]);

  const traffic = useMemo(() => {
    if (!selectedId) return [];
    const all = svc.getTraffic(selectedId);
    const selectedKinds: McpTrafficEvent["kind"][] =
      logTab === "stdout"
        ? ["raw_stdout"]
        : logTab === "stderr"
          ? ["raw_stderr"]
          : logTab === "parse"
            ? ["parse_error"]
            : ["request", "response", "process_closed", "spawn_error", "parse_error"];
    const filtered = all.filter((e) => selectedKinds.includes(e.kind));
    const q = logSearch.trim().toLowerCase();
    const searched = q ? filtered.filter((e) => asText(e).toLowerCase().includes(q)) : filtered;
    return searched.slice(Math.max(0, searched.length - trafficLimit));
  }, [selectedId, logTab, trafficLimit, logSearch, servers.length]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = logsRef.current;
    if (!el) return;
    try {
      el.scrollTop = el.scrollHeight;
    } catch {}
  }, [autoScroll, traffic.length, logTab]);

  const mergeServerConfigIntoDraft = (draftRaw: string, insertRaw: string): string => {
    const parsedDraft = JSON.parse(draftRaw);
    const insert = JSON.parse(insertRaw);
    const hasServers = insert && typeof insert === "object" && !Array.isArray(insert) && ((insert as any).servers || (insert as any).mcpServers);
    if (hasServers) {
      const next = insert as any;
      if (!next.schema_version) next.schema_version = "1";
      if (!Array.isArray(next.inputs)) next.inputs = [];
      if (!next.servers && next.mcpServers) {
        next.servers = next.mcpServers;
        delete next.mcpServers;
      }
      return JSON.stringify(next, null, 2);
    }

    const draftObj: any = parsedDraft && typeof parsedDraft === "object" && !Array.isArray(parsedDraft) ? parsedDraft : { schema_version: "1", servers: {} };
    if (!draftObj.schema_version) draftObj.schema_version = "1";
    if (!draftObj.servers && draftObj.mcpServers) {
      draftObj.servers = draftObj.mcpServers;
      delete draftObj.mcpServers;
    }
    if (!draftObj.servers || typeof draftObj.servers !== "object" || Array.isArray(draftObj.servers)) {
      draftObj.servers = {};
    }
    if (!Array.isArray(draftObj.inputs)) draftObj.inputs = [];

    if (insert && typeof insert === "object" && !Array.isArray(insert) && typeof (insert as any).id === "string" && (insert as any).id.trim()) {
      const id = String((insert as any).id).trim();
      const entry = { ...(insert as any) };
      delete entry.id;
      draftObj.servers[id] = entry;
      return JSON.stringify(draftObj, null, 2);
    }

    if (insert && typeof insert === "object" && !Array.isArray(insert)) {
      const keys = Object.keys(insert);
      const looksLikeServerEntry =
        typeof (insert as any).command === "string" ||
        typeof (insert as any).url === "string" ||
        typeof (insert as any).type === "string";
      if (!looksLikeServerEntry && keys.length > 0) {
        for (const k of keys) {
          if (!k) continue;
          const v = (insert as any)[k];
          if (!v || typeof v !== "object" || Array.isArray(v)) continue;
          draftObj.servers[k] = v;
        }
        return JSON.stringify(draftObj, null, 2);
      }
    }

    throw new Error("add_server_invalid_json");
  };

  const githubRemoteTemplate = () =>
    JSON.stringify(
      {
        id: "github_remote",
        type: "http",
        url: "https://api.githubcopilot.com/mcp/",
        headers: {
          Authorization: "Bearer ${input:github_mcp_pat}",
          "X-MCP-Toolsets": "repos,issues,pull_requests",
          "X-MCP-Readonly": "true"
        },
        enabled: true,
        tags: ["github", "mcp", "remote"]
      },
      null,
      2
    );

  const githubLocalTemplate = () =>
    JSON.stringify(
      {
        id: "github_local",
        command: "docker",
        args: ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "-e", "GITHUB_READ_ONLY", "ghcr.io/github/github-mcp-server"],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${input:github_mcp_pat}", GITHUB_READ_ONLY: "1" },
        enabled: true,
        tags: ["github", "mcp", "local", "docker"]
      },
      null,
      2
    );

  return (
    <div className="p-4">
      {!isTauri && (
        <div className="mb-3 border border-yellow-900/40 bg-yellow-900/10 rounded p-2 text-yellow-200 text-sm">
          Inspector actions require the desktop app (Tauri). You can still edit config and view stored state.
        </div>
      )}
      {knezNeeded && (
        <div className="mb-3 border border-zinc-800 bg-zinc-950 rounded p-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-300">
              <span className="font-semibold">KNEZ</span>{" "}
              <span className="text-zinc-400">{knez.endpoint}</span>{" "}
              <span className={`ml-2 ${knez.ok === true ? "text-emerald-300" : knez.ok === false ? "text-red-300" : "text-zinc-500"}`}>
                {knez.ok === true ? "healthy" : knez.ok === false ? "unreachable" : "unknown"}
              </span>
            </div>
            <button
              className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
              disabled={checkingKnez}
              onClick={() => {
                setCheckingKnez(true);
                void svc.refreshKnezHealth().finally(() => setCheckingKnez(false));
              }}
            >
              {checkingKnez ? "Checking…" : "Check"}
            </button>
          </div>
          {knez.ok === false && knez.error && (
            <div className="mt-2 text-[11px] text-red-300 whitespace-pre-wrap break-words">{knez.error}</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-400 mb-2 flex items-center justify-between">
            <div className="font-semibold text-zinc-200">MCP Config</div>
            <div className="flex items-center gap-2">
              <button
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                onClick={() => {
                  setRawDraft(cfg.raw);
                  setSaveError("");
                }}
                disabled={saving}
              >
                Reset
              </button>
              <button
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                onClick={() => {
                  setSaveError("");
                  svc.applyConfig(rawDraft);
                }}
                disabled={saving}
              >
                Apply
              </button>
              <button
                className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                onClick={() => {
                  setSaving(true);
                  setSaveError("");
                  void (async () => {
                    try {
                      await svc.saveConfig(rawDraft);
                      setSaveError("");
                    } catch (e: any) {
                      setSaveError(String(e?.message ?? e));
                    } finally {
                      setSaving(false);
                    }
                  })();
                }}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          <textarea
            className="w-full h-[260px] bg-zinc-950 border border-zinc-800 rounded p-2 text-[11px] font-mono text-zinc-200"
            value={rawDraft}
            onChange={(e) => setRawDraft(e.target.value)}
            spellCheck={false}
          />
          {saveError && (
            <div className="mt-2 border border-red-900/40 bg-red-900/10 rounded p-2 text-red-300 text-xs whitespace-pre-wrap break-words">
              {saveError}
            </div>
          )}
          <div className="mt-2 text-[11px] text-zinc-500">
            schema={cfg.normalized?.sourceSchema ?? "unknown"} servers={servers.length}
          </div>
          {(cfg.issues.length > 0 || Object.keys(cfg.issuesByServerId).some((k) => (cfg.issuesByServerId as any)[k]?.length)) && (
            <div className="mt-2 border border-zinc-800 rounded p-2 bg-zinc-950">
              <div className="text-xs text-zinc-300 font-semibold mb-1">Issues</div>
              {cfg.issues.map((it, idx) => (
                <div key={`g-${idx}`} className={`text-[11px] ${it.level === "error" ? "text-red-300" : "text-yellow-200"}`}>
                  {it.message}
                </div>
              ))}
              {Object.entries(cfg.issuesByServerId).map(([sid, list]) =>
                (list ?? []).length ? (
                  <div key={sid} className="mt-2">
                    <div className="text-[11px] text-zinc-400 mb-1">{sid}</div>
                    {(list ?? []).map((it, idx) => (
                      <div key={`${sid}-${idx}`} className={`text-[11px] ${it.level === "error" ? "text-red-300" : "text-yellow-200"}`}>
                        {it.field ? `${it.field}: ` : ""}{it.message}
                      </div>
                    ))}
                  </div>
                ) : null
              )}
            </div>
          )}

          <div className="mt-3">
            <div className="text-xs text-zinc-300 font-semibold mb-2 flex items-center justify-between gap-2">
              <div>Servers</div>
              <button
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                onClick={() => {
                  setAddServerError("");
                  setShowAddServer(true);
                  if (!addServerText.trim()) setAddServerText(githubRemoteTemplate());
                }}
              >
                +
              </button>
            </div>
            <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
              {servers.map((s) => {
                const st = statusById[s.id];
                const active = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    onClick={() => svc.setSelectedId(s.id)}
                    className={`w-full text-left rounded border px-2 py-2 transition-colors ${
                      active ? "border-blue-700 bg-blue-900/20" : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-[11px] text-zinc-200">{s.id}</div>
                      <div className="text-[10px] text-zinc-500">{st?.state ?? "IDLE"}</div>
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">{s.type === "http" ? s.url : s.command}</div>
                  </button>
                );
              })}
              {servers.length === 0 && <div className="text-xs text-zinc-500">No servers configured.</div>}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-zinc-200">Server</div>
            {selectedId && (
              <div className="font-mono text-[11px] text-zinc-400">
                {selectedId} pid={String(selected?.pid ?? "null")} framing={selected?.framing ?? "content-length"}
              </div>
            )}
          </div>

          {!selectedId || !selected ? (
            <div className="text-sm text-zinc-500">Select a server.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                  disabled={selected.type === "stdio" ? !isTauri : false}
                  onClick={() => {
                    void svc.start(selectedId).catch(() => {});
                  }}
                >
                  Start
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                  disabled={selected.type === "stdio" ? !isTauri : false}
                  onClick={() => {
                    void svc.stop(selectedId).catch(() => {});
                  }}
                >
                  Stop
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                  disabled={selected.type === "stdio" ? !isTauri : false}
                  onClick={() => {
                    void svc.restart(selectedId).catch(() => {});
                  }}
                >
                  Restart
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                  disabled={selected.type === "stdio" ? !isTauri : false}
                  onClick={() => {
                    void svc.initialize(selectedId).catch(() => {});
                  }}
                >
                  Initialize
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                  disabled={selected.type === "stdio" ? !isTauri : false}
                  onClick={() => {
                    void (async () => {
                      try {
                        await svc.initialize(selectedId);
                        await svc.listTools(selectedId, { waitForResult: true, timeoutMs: toolsListTimeoutMs });
                      } catch {}
                    })();
                  }}
                >
                  Test Connect
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                  disabled={selected.type === "stdio" ? !isTauri : false}
                  onClick={() => {
                    void svc.listTools(selectedId, { waitForResult: false, timeoutMs: toolsListTimeoutMs }).catch(() => {});
                  }}
                >
                  tools/list
                </button>
                <input
                  value={toolsListTimeoutMs}
                  onChange={(e) => setToolsListTimeoutMs(Math.max(1000, Number(e.target.value) || 0))}
                  className="text-[11px] px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 w-[110px]"
                  title="tools/list timeout (ms)"
                />
              </div>

              <div className="mt-3 text-[11px] text-zinc-400 font-mono space-y-1">
                {selected.type === "http" ? (
                  <>
                    <div>type=http</div>
                    <div className="break-all">url={selected.url ?? ""}</div>
                    {selected.headers && Object.keys(selected.headers).length > 0 && (
                      <div className="space-y-1">
                        <div>headers:</div>
                        {Object.entries(selected.headers)
                          .sort((a, b) => a[0].localeCompare(b[0]))
                          .slice(0, 24)
                          .map(([k, v]) => (
                            <div key={k} className="break-all">
                              {k}={maskHeaderValue(k, v)}
                            </div>
                          ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>type=stdio</div>
                    <div className="break-all">command={selected.command ?? ""}</div>
                    <div className="break-all">cwd={selected.cwd ?? ""}</div>
                  </>
                )}
              </div>

              {selectedId && (() => {
                const required = svc.getRequiredInputsForServer(selectedId);
                if (!required.length) return null;
                const resolved = new Set(svc.getResolvedInputIds());
                const metaById = new Map((svc.getInputs() ?? []).map((m: any) => [String(m.id), m]));
                return (
                  <div className="mt-3 border border-zinc-800 rounded p-2 bg-zinc-950">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-xs text-zinc-300 font-semibold">Inputs Vault</div>
                      <button
                        className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                        onClick={() => {
                          svc.clearAllInputValues();
                          setInputDrafts({});
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="space-y-2">
                      {required.map((id) => {
                        const meta: any = metaById.get(id) ?? null;
                        const isSet = resolved.has(id);
                        const draft = inputDrafts[id] ?? "";
                        const label = meta?.description ? `${id} (${meta.description})` : id;
                        return (
                          <div key={id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                            <div className={`text-[11px] font-mono ${isSet ? "text-emerald-300" : "text-yellow-200"}`}>{label}</div>
                            <input
                              value={draft}
                              onChange={(e) => setInputDrafts((prev) => ({ ...prev, [id]: e.target.value }))}
                              placeholder={isSet ? "set" : "required"}
                              type={meta?.password ? "password" : "text"}
                              className="md:col-span-1 text-[11px] px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 w-full"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                                onClick={() => {
                                  svc.setInputValue(id, draft);
                                  setInputDrafts((prev) => ({ ...prev, [id]: "" }));
                                }}
                              >
                                Set
                              </button>
                              <button
                                className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                                onClick={() => {
                                  svc.clearInputValue(id);
                                  setInputDrafts((prev) => ({ ...prev, [id]: "" }));
                                }}
                              >
                                Unset
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="mt-3 text-[11px] text-zinc-500 font-mono space-y-1">
                <div>state={selected.state} running={String(selected.running)} enabled={String(selected.enabled)} tools={selected.toolsCached} pending={String(selected.toolsPending)}</div>
                {selected.lastOkAt !== null && <div>last_ok={new Date(selected.lastOkAt).toLocaleString()}</div>}
                {selected.toolsCacheAt !== null && (
                  <div>
                    tools_cache_age_s={Math.max(0, Math.round((Date.now() - selected.toolsCacheAt) / 1000))}
                  </div>
                )}
                {selected.initializeDurationMs !== null && <div>initialize_ms={selected.initializeDurationMs}</div>}
                {selected.toolsListDurationMs !== null && <div>tools_list_ms={selected.toolsListDurationMs}</div>}
              </div>

              {selected.lastError && (
                <div className="mt-3 border border-red-900/40 bg-red-900/10 rounded p-2 text-red-300 text-xs whitespace-pre-wrap break-words">
                  {selected.lastError}
                </div>
              )}

              <div className="mt-3 grid grid-cols-1 gap-3">
                <div>
                  <div className="text-xs text-zinc-400 mb-1">stdout tail</div>
                  <pre className="bg-zinc-950 border border-zinc-800 rounded p-2 text-[10px] text-zinc-200 whitespace-pre-wrap break-words min-h-[96px] max-h-[160px] overflow-auto">
                    {selected.stdoutTail ?? ""}
                  </pre>
                </div>
                <div>
                  <div className="text-xs text-zinc-400 mb-1">stderr tail</div>
                  <pre className="bg-zinc-950 border border-zinc-800 rounded p-2 text-[10px] text-zinc-200 whitespace-pre-wrap break-words min-h-[96px] max-h-[160px] overflow-auto">
                    {selected.stderrTail ?? ""}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="font-semibold text-zinc-200 mb-2">Tools + Logs</div>

          <div className="grid grid-cols-1 gap-3">
            <div className="border border-zinc-800 rounded p-2 bg-zinc-950">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-zinc-300 font-semibold">Tools</div>
                <input
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  placeholder="search…"
                  className="text-[11px] px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 w-[200px]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="max-h-[180px] overflow-auto pr-1 space-y-1">
                  {tools.map((t) => (
                    <button
                      key={t.name}
                      className={`w-full text-left px-2 py-1 rounded border text-[11px] font-mono ${
                        selectedTool === t.name ? "border-blue-700 bg-blue-900/20 text-zinc-100" : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                      }`}
                      onClick={() => {
                        setSelectedTool(t.name);
                        setToolResult("");
                        setToolError("");
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                  {tools.length === 0 && <div className="text-xs text-zinc-500">No tools cached.</div>}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={toolTimeoutMs}
                      onChange={(e) => setToolTimeoutMs(Math.max(1000, Number(e.target.value) || 0))}
                      className="text-[11px] px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 w-[120px]"
                    />
                    <div className="text-[11px] text-zinc-500">timeout ms</div>
                    <button
                      disabled={((selected?.type ?? "stdio") === "stdio" ? !isTauri : false) || !selectedId || !selectedTool}
                      className="ml-auto text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                      onClick={() => {
                        setToolResult("");
                        setToolError("");
                        if (!selectedId || !selectedTool) return;
                        void (async () => {
                          try {
                            const args = JSON.parse(toolArgsText || "{}");
                            const res = await svc.callTool(selectedId, selectedTool, args, toolTimeoutMs);
                            setToolResult(JSON.stringify(res, null, 2));
                          } catch (e: any) {
                            setToolError(String(e?.message ?? e));
                          }
                        })();
                      }}
                    >
                      Call
                    </button>
                  </div>
                  <textarea
                    value={toolArgsText}
                    onChange={(e) => setToolArgsText(e.target.value)}
                    className="w-full h-[120px] bg-zinc-900 border border-zinc-800 rounded p-2 text-[11px] font-mono text-zinc-200"
                    spellCheck={false}
                  />
                  {toolError && (
                    <div className="mt-2 border border-red-900/40 bg-red-900/10 rounded p-2 text-red-300 text-xs whitespace-pre-wrap break-words">
                      {toolError}
                    </div>
                  )}
                  {toolResult && (
                    <pre className="mt-2 bg-zinc-900 border border-zinc-800 rounded p-2 text-[10px] text-zinc-200 whitespace-pre-wrap break-words max-h-[220px] overflow-auto">
                      {toolResult}
                    </pre>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-zinc-800 rounded p-2 bg-zinc-950">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setLogTab("traffic")} className={`text-xs px-2 py-1 rounded ${logTab === "traffic" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}>Traffic</button>
                <button onClick={() => setLogTab("stdout")} className={`text-xs px-2 py-1 rounded ${logTab === "stdout" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}>Stdout</button>
                <button onClick={() => setLogTab("stderr")} className={`text-xs px-2 py-1 rounded ${logTab === "stderr" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}>Stderr</button>
                <button onClick={() => setLogTab("parse")} className={`text-xs px-2 py-1 rounded ${logTab === "parse" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}>Parse</button>
                <input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="search…"
                  className="ml-1 text-[11px] px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 w-[160px]"
                />
                <button
                  onClick={() => {
                    const payload = traffic
                      .map((evt) => `[${formatTime(evt.at)}] ${evt.kind}\n${asText(evt)}`)
                      .join("\n\n---\n\n");
                    void navigator.clipboard?.writeText(payload);
                  }}
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => setAutoScroll((v) => !v)}
                  className={`text-xs px-2 py-1 rounded ${autoScroll ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
                  title="Auto-scroll logs"
                >
                  Auto
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <input
                    value={trafficLimit}
                    onChange={(e) => setTrafficLimit(Math.max(50, Math.min(2000, Number(e.target.value) || 0)))}
                    className="text-[11px] px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 w-[88px]"
                  />
                  <div className="text-[11px] text-zinc-500">events</div>
                </div>
              </div>
              <div ref={logsRef} className="max-h-[360px] overflow-auto border border-zinc-800 rounded bg-zinc-900 p-2">
                {traffic.length === 0 ? (
                  <div className="text-xs text-zinc-500">No events.</div>
                ) : (
                  <div className="space-y-2">
                    {traffic.map((evt, idx) => (
                      <div key={idx} className="border border-zinc-800 rounded p-2 bg-zinc-950">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                          <div>{evt.kind}</div>
                          <div>{formatTime(evt.at)}</div>
                        </div>
                        <pre className="text-[10px] text-zinc-200 whitespace-pre-wrap break-words">{asText(evt)}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddServer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
            <div className="flex items-center justify-between gap-3 p-3 border-b border-zinc-800">
              <div className="text-sm font-semibold text-zinc-200">Add MCP Server (JSON)</div>
              <button
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                onClick={() => {
                  setShowAddServer(false);
                }}
              >
                Close
              </button>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  onClick={() => {
                    setAddServerError("");
                    setAddServerText(githubRemoteTemplate());
                  }}
                >
                  GitHub Remote
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  onClick={() => {
                    setAddServerError("");
                    setAddServerText(githubLocalTemplate());
                  }}
                >
                  GitHub Local
                </button>
              </div>
              <textarea
                value={addServerText}
                onChange={(e) => setAddServerText(e.target.value)}
                className="w-full h-[240px] bg-zinc-900 border border-zinc-800 rounded p-2 text-[11px] font-mono text-zinc-200"
                spellCheck={false}
              />
              {addServerError && (
                <div className="border border-red-900/40 bg-red-900/10 rounded p-2 text-red-300 text-xs whitespace-pre-wrap break-words">
                  {addServerError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  onClick={() => {
                    setAddServerError("");
                    try {
                      const nextRaw = mergeServerConfigIntoDraft(rawDraft, addServerText);
                      setRawDraft(nextRaw);
                      svc.applyConfig(nextRaw);
                      setShowAddServer(false);
                    } catch (e: any) {
                      const msg = String(e?.message ?? e);
                      setAddServerError(msg === "add_server_invalid_json" ? "Invalid JSON. Paste a full config or a server object with id." : msg);
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
