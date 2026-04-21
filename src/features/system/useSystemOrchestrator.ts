import { useState, useCallback, useRef, useEffect } from "react";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { knezClient } from '../../services/knez/KnezClient';
import { isOverallHealthyStatus } from "../../utils/health";
import { logger } from '../../services/utils/LogService';

export type SystemStatus = "idle" | "starting" | "running" | "failed" | "degraded";

export type HealthProbeStatus = {
  active: boolean;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  lastCheckedAt: number | null;
};

export function useSystemOrchestrator(onReady?: () => void) {
  const [status, setStatus] = useState<SystemStatus>("idle");
  const [output, setOutput] = useState("");
  const [healthProbe, setHealthProbe] = useState<HealthProbeStatus>({
    active: false,
    attempts: 0,
    maxAttempts: 0,
    lastError: "",
    lastCheckedAt: null,
  });
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
    setHealthProbe({ active: false, attempts: 0, maxAttempts: 0, lastError: "", lastCheckedAt: null });

    // CP5-9: Fast-path Verification
    // Check if already running first
    try {
      const existingHealth = await knezClient.health({ timeoutMs: 4500 });
      if (isOverallHealthyStatus(existingHealth.status)) {
        setOutput((prev) => prev + "\n[Fast-Path] KNEZ is already running. Connected.");
        setStatus("running");
        setHealthProbe({ active: false, attempts: 0, maxAttempts: 0, lastError: "", lastCheckedAt: Date.now() });
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
      // Direct Rust spawn instead of PowerShell script
      setOutput((prev) => prev + "\n[Rust Spawn] Starting Ollama...");

      // Start Ollama first
      const ollamaCommand = Command.create("ollama", ["serve"]);
      ollamaCommand.on("error", (error) => {
        setOutput((prev) => prev + `\n[Ollama Error] ${error}`);
      });
      ollamaCommand.stdout.on("data", (line) => {
        setOutput((prev) => prev + `[Ollama] ${line}\n`);
      });
      ollamaCommand.stderr.on("data", (line) => {
        setOutput((prev) => prev + `[Ollama STDERR] ${line}\n`);
      });

      await ollamaCommand.spawn();
      setOutput((prev) => prev + "\n[Rust Spawn] Ollama started. Waiting for readiness...");

      // Wait for Ollama to be ready
      let ollamaReady = false;
      for (let i = 0; i < 20; i++) {
        try {
          const testResp = await fetch("http://localhost:11434/api/tags");
          if (testResp.ok) {
            ollamaReady = true;
            setOutput((prev) => prev + "\n[Rust Spawn] Ollama is ready.");
            break;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!ollamaReady) {
        setOutput((prev) => prev + "\n[Rust Spawn] Ollama failed to become ready.");
        setStatus("failed");
        return;
      }

      // Start KNEZ
      setOutput((prev) => prev + "\n[Rust Spawn] Starting KNEZ...");
      const knezPath = "C:\\Users\\syedm\\Downloads\\ASSETS\\controlAPP\\KNEZ";
      const knezCommand = Command.create("python", [
        "-m", "uvicorn",
        "knez.knez_core.app:app",
        "--app-dir", knezPath,
        "--host", "127.0.0.1",
        "--port", "8000"
      ]);
      knezCommand.on("close", (data) => {
        setOutput((prev) => prev + `\n[KNEZ exited with code ${data.code}]`);
        if (data.code !== 0) setStatus("failed");
      });
      knezCommand.on("error", (error) => {
        setOutput((prev) => prev + `\n[KNEZ Error] ${error}`);
        setStatus("failed");
      });
      knezCommand.stdout.on("data", (line) => {
        if (noOutputTimeoutRef.current !== null) {
          clearTimeout(noOutputTimeoutRef.current);
          noOutputTimeoutRef.current = null;
        }
        setOutput((prev) => prev + `[KNEZ] ${line}\n`);
      });
      knezCommand.stderr.on("data", (line) => {
        if (noOutputTimeoutRef.current !== null) {
          clearTimeout(noOutputTimeoutRef.current);
          noOutputTimeoutRef.current = null;
        }
        setOutput((prev) => prev + `[KNEZ STDERR] ${line}\n`);
      });

      if (noOutputTimeoutRef.current !== null) {
        clearTimeout(noOutputTimeoutRef.current);
        noOutputTimeoutRef.current = null;
      }
      noOutputTimeoutRef.current = window.setTimeout(() => {
        setOutput((prev) => prev + "\n[Rust Spawn] No output yet. Still waiting...");
      }, 5000);

      childRef.current = await knezCommand.spawn();

      // Wait 5s before starting health checks to give KNEZ time to fully start
      setTimeout(() => verifyHealthLoop(), 5000);

    } catch (e) {
      logger.error("system_orchestrator", "spawn_failed", { error: String(e) });
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
    setHealthProbe({ active: true, attempts: 0, maxAttempts, lastError: "", lastCheckedAt: null });
    
    const check = async () => {
      try {
        // T8: Use longer timeout for cold start (first 10 attempts), then normal timeout
        const timeoutMs = attempts < 10 ? 8000 : 4500;
        const h = await knezClient.health({ timeoutMs });
        if (noOutputTimeoutRef.current !== null) {
          clearTimeout(noOutputTimeoutRef.current);
          noOutputTimeoutRef.current = null;
        }
        const healthy = isOverallHealthyStatus(h.status);
        if (healthy) {
          setStatus("running");
          setHealthProbe({ active: false, attempts, maxAttempts, lastError: "", lastCheckedAt: Date.now() });
          verifyActiveRef.current = false;
          if (onReady) onReady();
        } else {
          setStatus("degraded");
          setHealthProbe({ active: true, attempts, maxAttempts, lastError: `status=${String(h.status)}`, lastCheckedAt: Date.now() });
          const jitter = Math.floor(Math.random() * 60);
          const delay = 400 + jitter;
          setTimeout(check, delay);
        }
      } catch (e: any) {
        lastErr = String(e?.message ?? e);
        attempts++;
        setHealthProbe({ active: true, attempts, maxAttempts, lastError: lastErr, lastCheckedAt: Date.now() });
        if (attempts < maxAttempts) {
          const jitter = Math.floor(Math.random() * 80);
          const base =
            attempts < 10
              ? 220
              : attempts < 30
                ? 400
                : attempts < 80
                  ? 650
                  : 900;
          const timeoutPenalty = lastErr.includes("timed out") ? 300 : 0;
          setTimeout(check, base + timeoutPenalty + jitter);
        } else {
          setOutput((prev) => prev + `\n[Timeout] Health check failed after launch. last_error=${lastErr}`);
          setStatus("failed");
          setHealthProbe({ active: false, attempts, maxAttempts, lastError: lastErr, lastCheckedAt: Date.now() });
          verifyActiveRef.current = false;
        }
      }
    };
    
    check();
  };

  const stopKnez = useCallback(async () => {
     try {
       setOutput((prev) => prev + "\n[Inject Failure] Stopping KNEZ...");
       const killScript =
         "$ErrorActionPreference='SilentlyContinue';" +
         "$k=(Get-NetTCPConnection -LocalPort 8000 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess);" +
         "if($k){Write-Host \"Killing KNEZ pid=$k\"; taskkill /PID $k /T /F | Out-Host}else{Write-Host \"No listener on 8000\"};" +
         "$o=(Get-NetTCPConnection -LocalPort 11434 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess);" +
         "if($o){Write-Host \"Killing Ollama pid=$o\"; taskkill /PID $o /T /F | Out-Host}else{Write-Host \"No listener on 11434\"}";
       const command = Command.create("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", killScript]);
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

  // T3.4: Cleanup refs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      verifyActiveRef.current = false;
      if (noOutputTimeoutRef.current !== null) {
        clearTimeout(noOutputTimeoutRef.current);
        noOutputTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    status,
    output,
    healthProbe,
    launchAndConnect,
    stopKnez
  };
}
