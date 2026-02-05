import React, { useState } from "react";
import { Command } from "@tauri-apps/plugin-shell";

export const SystemPanel: React.FC = () => {
  const [output, setOutput] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "failed">("idle");

  const startStack = async () => {
    setStatus("starting");
    setOutput("");
    
    // Phase A: Frontend-First Truth Audit
    const isTauri = !!(window as any).__TAURI__;
    console.log("[SystemPanel] Check:", {
      isTauri,
      hasShell: !!Command
    });

    if (!isTauri) {
      setOutput("[Error] Shell unavailable in web mode. Please run in Tauri.");
      setStatus("failed");
      return;
    }

    try {
      console.log("[SystemPanel] Creating command 'start-local-stack'...");
      // Execute the PowerShell script using the configured shell capability
      const command = Command.create("start-local-stack");
      console.log("[SystemPanel] Command created:", command);
      
      await command.on("close", (data: { code: number | null; signal: number | null }) => {
        setOutput((prev) => prev + `\n[Process exited with code ${data.code}]`);
        setStatus(data.code === 0 ? "running" : "failed");
      });

      await command.on("error", (error: any) => {
        setOutput((prev) => prev + `\n[Error] ${error}`);
        setStatus("failed");
      });

      await command.stdout.on("data", (line: string) => {
        setOutput((prev) => prev + line + "\n");
        if (line.includes("=== STACK READY ===")) {
          setStatus("running");
        }
      });

      await command.stderr.on("data", (line: string) => {
        setOutput((prev) => prev + `[STDERR] ${line}\n`);
      });

      await command.spawn();
      
    } catch (e) {
      console.error("[SystemPanel] Spawn error:", e);
      setOutput((prev) => prev + `\n[Failed to spawn command] ${e}`);
      setStatus("failed");
    }
  };

  return (
    <div className="text-xs text-zinc-400 border border-zinc-800 rounded p-3 bg-zinc-950/40 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-zinc-500">System Orchestration</div>
        <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
          status === "running" ? "bg-green-900/30 text-green-400" :
          status === "failed" ? "bg-red-900/30 text-red-400" :
          status === "starting" ? "bg-blue-900/30 text-blue-400" :
          "bg-zinc-800 text-zinc-500"
        }`}>
          {status}
        </div>
      </div>

      <div className="mb-3">
        <button
          onClick={startStack}
          disabled={status === "starting" || status === "running"}
          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 rounded border border-zinc-700 transition-colors"
        >
          {status === "running" ? "Stack Running" : "Start Local Stack"}
        </button>
      </div>

      <div className="bg-black/50 border border-zinc-800 rounded p-2 h-32 overflow-y-auto font-mono text-[10px] text-zinc-400 whitespace-pre-wrap">
        {output || "// Output will appear here..."}
      </div>
    </div>
  );
};
