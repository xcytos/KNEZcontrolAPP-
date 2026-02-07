import { useState, useCallback, useRef } from "react";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { knezClient } from "../../services/KnezClient";

export type SystemStatus = "idle" | "starting" | "running" | "failed" | "degraded";

export function useSystemOrchestrator(onReady?: () => void) {
  const [status, setStatus] = useState<SystemStatus>("idle");
  const [output, setOutput] = useState("");
  const launchAttemptRef = useRef(0);
  const childRef = useRef<Child | null>(null);
  const verifyActiveRef = useRef(false);
  const noOutputTimeoutRef = useRef<number | null>(null);

  const launchAndConnect = useCallback(async (force?: boolean) => {
    // Idempotency check
    const now = Date.now();
    if (now - launchAttemptRef.current < 2000 && status === "starting") return;
    launchAttemptRef.current = now;

    if (force && childRef.current) {
      try {
        await childRef.current.kill();
      } catch {}
      childRef.current = null;
    }

    setStatus("starting");
    setOutput("Initializing KNEZ local stack...");

    // CP5-9: Fast-path Verification
    // Check if already running first
    try {
      const existingHealth = await knezClient.health({ timeoutMs: 900 });
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
    // Fix: We enabled withGlobalTauri: true, so window.__TAURI__ should be available.
    // Also checking __TAURI_IPC__ for v2.
    const w = window as any;
    const isTauri = !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
    
    if (!isTauri) {
      setOutput((prev) => prev + "\n[Web Mode] Shell unavailable. Launch requires the desktop app.");
      setStatus("failed");
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
        if (noOutputTimeoutRef.current !== null) {
          clearTimeout(noOutputTimeoutRef.current);
          noOutputTimeoutRef.current = null;
        }
        setOutput((prev) => prev + line + "\n");
      });

      command.stderr.on("data", (line) => {
        if (noOutputTimeoutRef.current !== null) {
          clearTimeout(noOutputTimeoutRef.current);
          noOutputTimeoutRef.current = null;
        }
        setOutput((prev) => prev + `[STDERR] ${line}\n`);
      });

      if (noOutputTimeoutRef.current !== null) {
        clearTimeout(noOutputTimeoutRef.current);
        noOutputTimeoutRef.current = null;
      }
      noOutputTimeoutRef.current = window.setTimeout(() => {
        setOutput((prev) => prev + "\n[Shell] No output yet. Still waiting...");
      }, 5000);

      childRef.current = await command.spawn();
      
      // Start verifying immediately after spawn
      verifyHealthLoop();

    } catch (e) {
      console.error("[SystemPanel] Spawn error:", e);
      setOutput((prev) => prev + `\n[Failed to spawn command] ${e}`);
      setStatus("failed");
    }
  }, [onReady, status]);

  const verifyHealthLoop = async () => {
    if (verifyActiveRef.current) return;
    verifyActiveRef.current = true;
    let attempts = 0;
    const maxAttempts = 180; // 180 * 500ms = 90s timeout
    let lastErr = "";
    
    const check = async () => {
      try {
        await knezClient.health({ timeoutMs: 900 });
        if (noOutputTimeoutRef.current !== null) {
          clearTimeout(noOutputTimeoutRef.current);
          noOutputTimeoutRef.current = null;
        }
        setStatus("running");
        if (onReady) onReady();
        verifyActiveRef.current = false;
      } catch (e: any) {
        lastErr = String(e?.message ?? e);
        attempts++;
        if (attempts % 10 === 0) {
          setOutput((prev) => prev + `\n[Health] Waiting for /health... (${attempts}/${maxAttempts}) last_error=${lastErr}`);
        }
        if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          setOutput((prev) => prev + `\n[Timeout] Health check failed after launch. last_error=${lastErr}`);
          setStatus("failed");
          verifyActiveRef.current = false;
        }
      }
    };
    
    check();
  };

  const stopKnez = useCallback(async () => {
     try {
       // In a real scenario, we might call a stop script or kill the process ID if we tracked it.
       // Since 'start-local-stack' spawns separate processes, killing the command object might not be enough
       // if it spawned detached children.
       // However, for "Failure Injection", we can try to call a stop command.
       // Or we can just call the OS kill command via shell.
       
       setOutput((prev) => prev + "\n[Inject Failure] Stopping KNEZ...");
       // Assuming Windows: taskkill /IM python.exe /F
       // NOTE: This is aggressive but fits "Failure Injection".
       // We need "stop-local-stack" command or similar.
       const command = Command.create("exec", ["/F", "/IM", "python.exe"]);
       command.on("close", (data) => {
         setOutput((prev) => prev + `\n[Stop exited with code ${data.code}]`);
       });
       command.on("error", (error) => {
         setOutput((prev) => prev + `\n[Stop error] ${String(error)}`);
       });
       command.stdout.on("data", (line) => setOutput((prev) => prev + String(line)));
       command.stderr.on("data", (line) => setOutput((prev) => prev + `[STDERR] ${String(line)}`));
       await command.spawn();
       
       setStatus("failed"); // Manually set to failed to reflect "Down" state immediately?
       // Actually, the status provider should detect it. But we update local status too.
       setOutput((prev) => prev + "\n[Inject Failure] KNEZ process killed.");
     } catch (e) {
       setOutput((prev) => prev + `\n[Stop Failed] ${e}`);
     }
  }, []);

  return {
    status,
    output,
    launchAndConnect,
    stopKnez
  };
}
