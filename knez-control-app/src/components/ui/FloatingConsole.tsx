import React, { useEffect, useRef, useState } from "react";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { TerminalSquare } from "lucide-react";
import { logger, LogEntry } from "../../services/LogService";

type Tab = "logs" | "terminal";

type TerminalCommandId =
  | "start-local-stack"
  | "start-knez"
  | "start-ollama"
  | "verify-delivery"
  | "stop-python"
  | "powershell";

const COMMANDS: { id: TerminalCommandId; label: string; kind: "spawn" }[] = [
  { id: "start-local-stack", label: "Start Local Stack", kind: "spawn" },
  { id: "start-knez", label: "Start KNEZ", kind: "spawn" },
  { id: "start-ollama", label: "Start Ollama", kind: "spawn" },
  { id: "verify-delivery", label: "Verify Delivery", kind: "spawn" },
  { id: "stop-python", label: "Stop Python (taskkill)", kind: "spawn" },
  { id: "powershell", label: "PowerShell (custom)", kind: "spawn" },
];

export const FloatingConsole: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("logs");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cmd, setCmd] = useState<TerminalCommandId>("start-local-stack");
  const [cmdOutput, setCmdOutput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [psCommand, setPsCommand] = useState<string>("Get-Date");

  const childRef = useRef<Child | null>(null);
  const w = window as any;
  const isTauri = !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;

  useEffect(() => {
    setLogs(logger.getLogs().slice(0, 200));
    const unsub = logger.subscribe((entry) => {
      setLogs((prev) => [entry, ...prev].slice(0, 200));
    });
    return unsub;
  }, []);

  const append = (line: string) => {
    setCmdOutput((prev) => (prev ? prev + "\n" + line : line));
  };

  const stop = async () => {
    try {
      if (childRef.current) {
        await childRef.current.kill();
      }
    } catch {}
    childRef.current = null;
    setRunning(false);
  };

  const run = async () => {
    if (!isTauri) {
      append("[Web Mode] Terminal requires the desktop app.");
      return;
    }
    if (running) return;

    setRunning(true);
    append(`[RUN] ${cmd}`);

    try {
      if (cmd === "powershell") {
        const command = Command.create("powershell", [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          psCommand,
        ]);
        command.on("close", (data) => {
          append(`[EXIT] code=${data.code}`);
          childRef.current = null;
          setRunning(false);
        });
        command.on("error", (error) => {
          append(`[ERROR] ${String(error)}`);
          childRef.current = null;
          setRunning(false);
        });
        command.stdout.on("data", (line) => append(String(line).trimEnd()));
        command.stderr.on("data", (line) => append(`[STDERR] ${String(line).trimEnd()}`));
        childRef.current = await command.spawn();
        return;
      }

      if (cmd === "stop-python") {
        const command = Command.create("exec", ["/F", "/IM", "python.exe"]);
        command.on("close", (data) => {
          append(`[EXIT] code=${data.code}`);
          childRef.current = null;
          setRunning(false);
        });
        command.on("error", (error) => {
          append(`[ERROR] ${String(error)}`);
          childRef.current = null;
          setRunning(false);
        });
        command.stdout.on("data", (line) => append(String(line).trimEnd()));
        command.stderr.on("data", (line) => append(`[STDERR] ${String(line).trimEnd()}`));
        childRef.current = await command.spawn();
        return;
      }

      const command = Command.create(cmd);
      command.on("close", (data) => {
        append(`[EXIT] code=${data.code}`);
        childRef.current = null;
        setRunning(false);
      });
      command.on("error", (error) => {
        append(`[ERROR] ${String(error)}`);
        childRef.current = null;
        setRunning(false);
      });
      command.stdout.on("data", (line) => append(String(line).trimEnd()));
      command.stderr.on("data", (line) => append(`[STDERR] ${String(line).trimEnd()}`));

      childRef.current = await command.spawn();
    } catch (e) {
      append(`[ERROR] ${String(e)}`);
      childRef.current = null;
      setRunning(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 shadow-lg flex items-center justify-center text-zinc-200 hover:bg-zinc-800 transition-colors z-50"
        title="System Console"
      >
        <TerminalSquare size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-end p-5">
          <div className="w-[520px] h-[420px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTab("logs")}
                  className={`text-xs px-2 py-1 rounded ${
                    tab === "logs" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Logs
                </button>
                <button
                  onClick={() => setTab("terminal")}
                  className={`text-xs px-2 py-1 rounded ${
                    tab === "terminal" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Terminal
                </button>
              </div>
              <div className="flex items-center gap-2">
                {tab === "terminal" && (
                  <button
                    onClick={() => setCmdOutput("")}
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => {
                    stop();
                    setOpen(false);
                  }}
                  className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {tab === "logs" ? (
              <div className="flex-1 overflow-auto p-3 space-y-2 text-xs font-mono text-zinc-200">
                {logs.length === 0 ? (
                  <div className="text-zinc-500">No logs yet.</div>
                ) : (
                  logs.map((l) => (
                    <div key={l.id} className="border border-zinc-900 rounded p-2 bg-zinc-900/20">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-zinc-500">
                          {new Date(l.timestamp).toLocaleTimeString()} • {l.category}
                        </div>
                        <div
                          className={`text-[10px] font-bold ${
                            l.level === "ERROR"
                              ? "text-red-400"
                              : l.level === "WARN"
                                ? "text-orange-400"
                                : l.level === "DEBUG"
                                  ? "text-blue-400"
                                  : "text-emerald-400"
                          }`}
                        >
                          {l.level}
                        </div>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap break-words">{l.message}</div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
                  <select
                    value={cmd}
                    onChange={(e) => setCmd(e.target.value as TerminalCommandId)}
                    className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-2 flex-1"
                    disabled={running}
                  >
                    {COMMANDS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {cmd === "powershell" && (
                    <input
                      value={psCommand}
                      onChange={(e) => setPsCommand(e.target.value)}
                      placeholder="PowerShell -Command ..."
                      className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-2 flex-1"
                      disabled={running}
                    />
                  )}
                  <button
                    onClick={run}
                    disabled={running}
                    className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
                  >
                    Run
                  </button>
                  <button
                    onClick={stop}
                    disabled={!running}
                    className="px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded transition-colors"
                  >
                    Stop
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-3 text-[11px] font-mono text-zinc-200 whitespace-pre-wrap">
                  {cmdOutput || "Ready."}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
