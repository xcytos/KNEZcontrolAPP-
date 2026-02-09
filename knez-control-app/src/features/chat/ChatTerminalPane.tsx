import React, { useEffect, useRef, useState } from "react";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { FolderOpen, Play, Square, Trash2 } from "lucide-react";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!(w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke ?? w.__TAURI_INTERNALS__ ?? w.__TAURI_IPC__);
}

function nowStamp(): string {
  try {
    return new Date().toISOString();
  } catch {
    return String(Date.now());
  }
}

export const ChatTerminalPane: React.FC = () => {
  const [cwd, setCwd] = useState<string>("");
  const [command, setCommand] = useState<string>("Get-Location");
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const childRef = useRef<Child | null>(null);
  const outRef = useRef<HTMLDivElement | null>(null);

  const append = (line: string) => {
    setOutput((prev) => (prev ? prev + "\n" + line : line));
  };

  useEffect(() => {
    const el = outRef.current;
    if (!el) return;
    try {
      (el as any).scrollTo?.({ top: el.scrollHeight });
      if (typeof (el as any).scrollTo !== "function") {
        el.scrollTop = el.scrollHeight;
      }
    } catch {
      try {
        el.scrollTop = el.scrollHeight;
      } catch {}
    }
  }, [output]);

  const stop = async () => {
    try {
      await childRef.current?.kill();
    } catch {}
    childRef.current = null;
    setRunning(false);
  };

  const selectDirectory = async () => {
    if (!isTauriRuntime()) {
      append(`[${nowStamp()}] [WEB] Directory picker requires the desktop app (Tauri).`);
      return;
    }
    try {
      const script =
        "Add-Type -AssemblyName System.Windows.Forms;" +
        "$d=New-Object System.Windows.Forms.FolderBrowserDialog;" +
        "$d.Description='Select working directory';" +
        "$d.ShowNewFolderButton=$true;" +
        "if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){$d.SelectedPath}";
      const res = await Command.create(
        "powershell",
        ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
        { encoding: "utf-8" }
      ).execute();
      const picked = String((res as any)?.stdout ?? "").trim();
      if (picked) {
        setCwd(picked);
        append(`[${nowStamp()}] [CWD] ${picked}`);
      }
    } catch (e: any) {
      append(`[${nowStamp()}] [ERROR] ${String(e?.message ?? e)}`);
    }
  };

  const run = async () => {
    if (!command.trim()) return;
    if (!isTauriRuntime()) {
      append(`[${nowStamp()}] [WEB] Terminal requires the desktop app (Tauri).`);
      return;
    }
    if (running) return;
    setRunning(true);
    append(`[${nowStamp()}] [RUN] ${command}`);
    try {
      const cmd = Command.create(
        "powershell",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
        { encoding: "utf-8", cwd: cwd || undefined }
      );
      cmd.on("close", (evt) => {
        append(`[${nowStamp()}] [EXIT] code=${evt.code ?? "null"}`);
        childRef.current = null;
        setRunning(false);
      });
      cmd.on("error", (err) => {
        append(`[${nowStamp()}] [ERROR] ${String((err as any)?.message ?? err)}`);
        childRef.current = null;
        setRunning(false);
      });
      cmd.stdout.on("data", (line) => append(String(line).trimEnd()));
      cmd.stderr.on("data", (line) => append(`[STDERR] ${String(line).trimEnd()}`));
      childRef.current = await cmd.spawn();
    } catch (e: any) {
      append(`[${nowStamp()}] [ERROR] ${String(e?.message ?? e)}`);
      childRef.current = null;
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void selectDirectory()}
          className="px-3 py-1.5 rounded-md text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-2"
          title="Select working directory"
        >
          <FolderOpen size={14} />
          Directory
        </button>
        <input
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          placeholder="Working directory (optional)"
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 font-mono"
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="px-3 py-1.5 rounded-md text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white flex items-center gap-2"
        >
          <Play size={14} />
          Run
        </button>
        <button
          type="button"
          onClick={() => void stop()}
          disabled={!running}
          className="px-3 py-1.5 rounded-md text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 flex items-center gap-2"
        >
          <Square size={14} />
          Stop
        </button>
        <button
          type="button"
          onClick={() => setOutput("")}
          className="px-3 py-1.5 rounded-md text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-2"
        >
          <Trash2 size={14} />
          Clear
        </button>
      </div>

      <div className="p-3 border-b border-zinc-800 bg-zinc-950/40">
        <div className="flex gap-2">
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void run();
              }
            }}
            placeholder="PowerShell command (Ctrl+Enter to run)"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 font-mono"
          />
        </div>
        <div className="mt-2 text-[10px] text-zinc-500 font-mono">engine=powershell hotkey=ctrl+enter</div>
      </div>

      <div ref={outRef} className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-zinc-200 whitespace-pre-wrap">
        {output || "Ready."}
      </div>
    </div>
  );
};
