import { useState, useCallback, useRef } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { knezClient } from "../../services/KnezClient";

export type SystemStatus = "idle" | "starting" | "running" | "failed" | "degraded";

export function useSystemOrchestrator(onReady?: () => void) {
  const [status, setStatus] = useState<SystemStatus>("idle");
  const [output, setOutput] = useState("");
  const launchAttemptRef = useRef(0);

  const launchAndAssumeRunning = useCallback(async () => {
    // Idempotency check
    const now = Date.now();
    if (now - launchAttemptRef.current < 2000 && status === "starting") return;
    launchAttemptRef.current = now;

    setStatus("starting");
    setOutput("Initializing KNEZ local stack...");

    // CP5-9: Fast-path Verification
    // Check if already running first
    try {
      const existingHealth = await knezClient.health();
      if (existingHealth.status === "ok") {
        setOutput((prev) => prev + "\n[Fast-Path] KNEZ is already running. Connected.");
        setStatus("running");
        if (onReady) onReady();
        return;
      }
    } catch {
      // Not running, proceed to launch
    }

    // Launch Logic
    const isTauri = !!(window as any).__TAURI__;
    if (!isTauri) {
      // WEB MODE MOCK
      setOutput((prev) => prev + "\n[Web Mode] Shell unavailable. Simulating launch...");
      setTimeout(() => {
        setOutput((prev) => prev + "\n[Mock] Stack launched.");
        setStatus("running"); // Optimistic for web
        if (onReady) onReady();
      }, 800);
      return;
    }

    try {
      setOutput((prev) => prev + "\n[Shell] Spawning start-local-stack...");
      const command = Command.create("start-local-stack");
      
      command.on("close", (data) => {
        setOutput((prev) => prev + `\n[Process exited with code ${data.code}]`);
        if (data.code !== 0) setStatus("failed");
      });

      command.on("error", (error) => {
        setOutput((prev) => prev + `\n[Error] ${error}`);
        setStatus("failed");
      });

      command.stdout.on("data", (line) => {
        setOutput((prev) => prev + line + "\n");
        // We still look for the signal, but rely on polling for truth
        if (line.includes("Uvicorn running")) {
           verifyHealthLoop();
        }
      });

      command.stderr.on("data", (line) => {
        setOutput((prev) => prev + `[STDERR] ${line}\n`);
      });

      await command.spawn();
      
      // Start verifying immediately after spawn
      verifyHealthLoop();

    } catch (e) {
      console.error("[SystemPanel] Spawn error:", e);
      setOutput((prev) => prev + `\n[Failed to spawn command] ${e}`);
      setStatus("failed");
    }
  }, [onReady, status]);

  const verifyHealthLoop = async () => {
    let attempts = 0;
    const maxAttempts = 20; // 20 * 500ms = 10s timeout
    
    const check = async () => {
      try {
        await knezClient.health();
        setStatus("running");
        if (onReady) onReady();
      } catch {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          setOutput((prev) => prev + "\n[Timeout] Health check failed after launch.");
          setStatus("failed");
        }
      }
    };
    
    check();
  };

  return {
    status,
    output,
    launchAndAssumeRunning
  };
}
