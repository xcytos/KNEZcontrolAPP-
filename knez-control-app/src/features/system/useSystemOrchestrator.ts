import { useState, useCallback, useRef, useEffect } from "react";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { knezClient } from '../../services/knez/KnezClient';
import { isOverallHealthyStatus } from "../../utils/health";
import { logger } from '../../services/utils/LogService';
import { circuitBreakerRegistry } from '../../utils/CircuitBreaker';
import { serviceDegradationManager } from '../../services/resilience/ServiceDegradation';
import { serviceDiscovery } from '../../services/resilience/ServiceDiscovery';

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
  const isLaunching = useRef(false);
  const startupTimeoutRef = useRef<number | null>(null);

  // Initialize resilience components
  useEffect(() => {
    // Create circuit breakers for critical services
    circuitBreakerRegistry.create('ollama', {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000,
      halfOpenMaxCalls: 2
    });

    circuitBreakerRegistry.create('knez-backend', {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 120000,
      halfOpenMaxCalls: 3
    });

    // Subscribe to degradation level changes
    const unsubscribe = serviceDegradationManager.onDegradationLevelChange((level, _services) => {
      console.info(`[SystemOrchestrator] Service level changed to: ${level}`);
      
      // Update UI status based on degradation level
      switch (level) {
        case 'full':
          // Keep current status, don't downgrade if already running
          break;
        case 'degraded':
          if (status === 'running') {
            setStatus('degraded');
            setOutput(prev => prev + "\n[Degradation] Some services unavailable, using fallbacks.");
          }
          break;
        case 'minimal':
          setStatus('degraded');
          setOutput(prev => prev + "\n[Degradation] Minimal service level active.");
          break;
        case 'offline':
          setStatus('failed');
          setOutput(prev => prev + "\n[Degradation] All services unavailable.");
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [status]);

  // System requirements check
  const checkSystemRequirements = useCallback(async () => {
    setOutput((prev) => prev + "[System Check] Verifying requirements...");

    // Check Python - try both 'python' and 'python3' with improved detection
    let pythonInstalled = false;
    const pythonCommands = ["python", "python3"];
    for (const cmd of pythonCommands) {
      try {
        const pythonCheck = Command.create("cmd", ["/c", cmd, "--version"]);
        const closePromise = new Promise<boolean>((resolve) => {
          pythonCheck.on("close", (data) => {
            resolve(data.code === 0);
          });
        });
        await pythonCheck.spawn();
        const success = await Promise.race([
          closePromise,
          new Promise<boolean>(r => setTimeout(() => r(false), 2000))
        ]);
        if (success) {
          pythonInstalled = true;
          setOutput((prev) => prev + `[System Check] ✓ Python is installed (${cmd}).`);
          break;
        }
      } catch {
        // Try next command
      }
    }
    if (!pythonInstalled) {
      setOutput((prev) => prev + "[System Check] ⚠ Python not detected in PATH. Will attempt to use Python from KNEZ path.");
      // Don't fail - KNEZ may have its own Python or use virtual environment
    }

    // Check Ollama - make it optional since it can be started later
    try {
      const ollamaPort = (import.meta.env.VITE_OLLAMA_PORT as string) || "11434";
      const ollamaHttpCheck = await fetch(`http://localhost:${ollamaPort}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (ollamaHttpCheck.ok) {
        setOutput((prev) => prev + "[System Check] ✓ Ollama is already running and reachable.");
      }
    } catch {
      setOutput((prev) => prev + "[System Check] ⚠ Ollama not running (will attempt to start).");
    }

    // Check port availability
    try {
      const portCheck8000 = Command.create("cmd", ["/c", "netstat", "-ano", "|", "findstr", ":8000"]);
      await portCheck8000.spawn();
      await new Promise(r => setTimeout(r, 500));
      setOutput((prev) => prev + "[System Check] ⚠ Port 8000 may be in use (will attempt cleanup).");
    } catch {
      setOutput((prev) => prev + "[System Check] ✓ Port 8000 appears available.");
    }

    setOutput((prev) => prev + "[System Check] Requirements check complete.\n");
    return true; // Always return true - we'll handle missing dependencies during startup
  }, []);

  const launchAndConnect = useCallback(async (force?: boolean) => {
    // Guard against multiple concurrent launches (unless forced)
    if (isLaunching.current && !force) {
      setOutput((prev) => prev + "\n[Startup] Already in progress, skipping duplicate request.");
      return;
    }
    isLaunching.current = true;

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

    // System requirements check
    const requirementsMet = await checkSystemRequirements();
    if (!requirementsMet) {
      setOutput((prev) => prev + "\n[System Check Failed] Please install required dependencies and try again.");
      setStatus("failed");
      isLaunching.current = false;
      return;
    }

    // Startup timeout (120 seconds)
    startupTimeoutRef.current = window.setTimeout(() => {
      if (status === "starting") {
        setOutput((prev) => prev + "\n[Timeout] Startup taking longer than expected (120s). Check logs for errors.");
        setStatus("failed");
        isLaunching.current = false;
      }
    }, 120000);

    // CP5-9: Fast-path Verification with Service Discovery
    // Check if already running first using smart discovery
    let knezAlreadyRunning = false;
    try {
      setOutput((prev) => prev + "\n[Discovery] Checking for existing services...");
      
      // Use circuit breaker for health checks
      const knezBreaker = circuitBreakerRegistry.get('knez-backend');
      if (knezBreaker) {
        const existingHealth = await knezBreaker.execute(async () => {
          return await knezClient.health({ timeoutMs: 4500 });
        });
        
        if (isOverallHealthyStatus(existingHealth.status)) {
          // Check if Ollama is also reachable using service discovery
          const ollamaResult = await serviceDiscovery.discoverService('ollama');
          const ollamaReachable = ollamaResult.endpoint !== null;
          
          if (ollamaReachable) {
            // Both KNEZ and Ollama are healthy - fast-path is valid
            setOutput((prev) => prev + "\n[Fast-Path] KNEZ is already running. Connected.");
            setOutput((prev) => prev + `[Fast-Path] Ollama found at: ${ollamaResult.endpoint?.url}`);
            setStatus("running");
            setHealthProbe({ active: false, attempts: 0, maxAttempts: 0, lastError: "", lastCheckedAt: Date.now() });
            
            // Update service degradation manager
            await serviceDegradationManager.checkAllServices();
            
            if (onReady) onReady();
            return;
          } else {
            // KNEZ is healthy but Ollama is not - skip fast-path, start Ollama only
            knezAlreadyRunning = true;
            setOutput((prev) => prev + "\n[Fast-Path] KNEZ is running but Ollama not reachable. Starting Ollama...");
          }
        }
      }
    } catch {
      // Not running, proceed to full launch
      setOutput((prev) => prev + "\n[Discovery] No existing services found, proceeding with full startup...");
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
      setOutput((prev) => prev + "\n[1/2] Starting Ollama server...");
      
      // Smart startup: Check if Ollama is already running
      setOutput((prev) => prev + "[Ollama] Checking if Ollama is already running...");
      let ollamaAlreadyRunning = false;
      try {
        const ollamaPort = (import.meta.env.VITE_OLLAMA_PORT as string) || "11434";
        const testResp = await fetch(`http://localhost:${ollamaPort}/api/tags`);
        if (testResp.ok) {
          ollamaAlreadyRunning = true;
          setOutput((prev) => prev + "[Ollama] ✓ Already running and reachable.\n");
        }
      } catch {
        setOutput((prev) => prev + "[Ollama] Not running, will start new instance.\n");
      }

      // Only kill and start if not already running
      if (!ollamaAlreadyRunning) {
        // Port cleanup: Kill existing Ollama processes
        setOutput((prev) => prev + "[Ollama] Checking for existing Ollama processes...");
        try {
          const killCommand = Command.create("cmd", ["/c", "taskkill", "/F", "/IM", "ollama.exe"]);
          await killCommand.spawn();
          setOutput((prev) => prev + "[Ollama] Existing processes cleaned up.\n");
        } catch (e) {
          setOutput((prev) => prev + "[Ollama] No existing processes to clean up.\n");
        }

        setOutput((prev) => prev + "[Ollama] Spawning ollama serve via PowerShell script...");

        // Use cmd.exe to run PowerShell script (avoids shell plugin requirement)
        const ollamaCommand = Command.create("cmd", [
          "/c", "powershell", "-ExecutionPolicy", "Bypass", "-File", "scripts/start_ollama.ps1"
        ]);
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
        setOutput((prev) => prev + "[Ollama] Process spawned successfully.");
        setOutput((prev) => prev + "[Ollama] Waiting for API to become ready (polling /api/tags)...");

        // Wait for Ollama to be ready
        let ollamaReady = false;
        for (let i = 0; i < 20; i++) {
          try {
            const ollamaPort = (import.meta.env.VITE_OLLAMA_PORT as string) || "11434";
            const testResp = await fetch(`http://localhost:${ollamaPort}/api/tags`);
            if (testResp.ok) {
              ollamaReady = true;
              const data = await testResp.json() as any;
              const models = data?.models ?? [];
              const modelNames = models.map((m: any) => m.name).join(", ");
              setOutput((prev) => prev + `[Ollama] API ready! Found ${models.length} model(s): ${modelNames || "none"}\n`);
              setOutput((prev) => prev + "[Ollama] ✓ Ready to accept requests.\n");
              break;
            }
          } catch {}
          setOutput((prev) => prev + `[Ollama] Waiting... (${i + 1}/20)`);
          await new Promise(r => setTimeout(r, 1000));
        }

        if (!ollamaReady) {
          setOutput((prev) => prev + "\n[Ollama] ✗ Failed to become ready after 20 attempts.");
          setStatus("failed");
          return;
        }
      } // End of if (!ollamaAlreadyRunning)
      else {
        setOutput((prev) => prev + "[Ollama] Skipping startup - already running.\n");
      }

      // Start KNEZ only if not already running
      if (!knezAlreadyRunning) {
        setOutput((prev) => prev + "\n[2/2] Starting KNEZ backend...");
        
        // Smart startup: Check if KNEZ is already running
        setOutput((prev) => prev + "[KNEZ] Checking if KNEZ is already running...");
        let knezAlreadyRunningLocal = false;
        try {
          const testResp = await fetch("http://127.0.0.1:8000/health");
          if (testResp.ok) {
            knezAlreadyRunningLocal = true;
            setOutput((prev) => prev + "[KNEZ] ✓ Already running and healthy.\n");
          }
        } catch {
          setOutput((prev) => prev + "[KNEZ] Not running, will start new instance.\n");
        }

        // Only kill and start if not already running
        if (!knezAlreadyRunningLocal) {
          // Port cleanup: Kill existing KNEZ python processes
          setOutput((prev) => prev + "[KNEZ] Checking for existing KNEZ processes...");
          try {
            const killCommand = Command.create("cmd", ["/c", "taskkill", "/F", "/IM", "python.exe"]);
            await killCommand.spawn();
            setOutput((prev) => prev + "[KNEZ] Existing processes cleaned up.\n");
          } catch (e) {
            setOutput((prev) => prev + "[KNEZ] No existing processes to clean up.\n");
          }
        
        setOutput((prev) => prev + "[KNEZ] Configuration:");
        setOutput((prev) => prev + "[KNEZ]   Model: qwen2.5:7b-instruct-q4_K_M");
        const knezPort = (import.meta.env.VITE_KNEZ_PORT as string) || "8000";
        setOutput((prev) => prev + `[KNEZ]   Endpoint: http://127.0.0.1:${knezPort}`);
        const knezPath = "C:\\Users\\syedm\\Downloads\\ASSETS\\controlAPP\\KNEZ";
        setOutput((prev) => prev + `[KNEZ]   Path: ${knezPath}`);
        
        // Path validation
        setOutput((prev) => prev + "[KNEZ] Validating path...");
        try {
          const testPathCommand = Command.create("powershell", [
            "-Command",
            `if (Test-Path '${knezPath}') { Write-Output 'PATH_VALID' } else { Write-Output 'PATH_INVALID' }`
          ]);
          testPathCommand.on("close", (data) => {
            if (data.code === 0) {
              setOutput((prev) => prev + "[KNEZ] ✓ Path validation passed.\n");
            } else {
              setOutput((prev) => prev + "[KNEZ] ✗ Path validation failed: Directory does not exist.\n");
              setOutput((prev) => prev + `[KNEZ] Please verify the path: ${knezPath}\n`);
              setStatus("failed");
              isLaunching.current = false;
            }
          });
          await testPathCommand.spawn();
          await new Promise(r => setTimeout(r, 1000)); // Wait for validation
        } catch (e) {
          setOutput((prev) => prev + `[KNEZ] ⚠ Path validation warning: ${String(e)}\n`);
        }
        
        setOutput((prev) => prev + "[KNEZ] Spawning uvicorn process via Rust shell plugin...");
        const knezCommand = Command.create("cmd", [
          "/c",
          "set", "DEFAULT_MODEL=qwen2.5:7b-instruct-q4_K_M",
          "&&",
          "cd", "/d", knezPath,
          "&&",
          "python", "-m", "uvicorn",
          "knez.knez_core.app:app",
          "--app-dir", ".",
          "--host", "127.0.0.1",
          "--port", "8000"
        ]);
        knezCommand.on("close", (data) => {
          setOutput((prev) => prev + `\n[KNEZ] Process exited with code ${data.code}`);
          if (data.code !== 0) setStatus("failed");
        });
        knezCommand.on("error", (error) => {
          setOutput((prev) => prev + `\n[KNEZ] Error: ${error}`);
          setStatus("failed");
        });
        knezCommand.stdout.on("data", (line) => {
          if (noOutputTimeoutRef.current !== null) {
            clearTimeout(noOutputTimeoutRef.current);
            noOutputTimeoutRef.current = null;
          }
          setOutput((prev) => prev + `[KNEZ STDOUT] ${line}`);
        });
        knezCommand.stderr.on("data", (line) => {
          setOutput((prev) => prev + `[KNEZ STDERR] ${line}`);
        });

        await knezCommand.spawn();
        setOutput((prev) => prev + "[KNEZ] Process spawned successfully.");

        // Wait for KNEZ to be ready with enhanced retry logic
        setOutput((prev) => prev + "[KNEZ] Waiting for health check...");
        let knezReady = false;
        const maxRetries = 30;
        const retryDelay = 1000;
        let lastError = "";
        
        for (let i = 0; i < maxRetries; i++) {
          try {
            const healthResp = await fetch("http://127.0.0.1:8000/health", { signal: AbortSignal.timeout(2000) });
            if (healthResp.ok) {
              knezReady = true;
              setOutput((prev) => prev + `[KNEZ] ✓ Health check passed after ${i + 1} attempt(s).\n`);
              break;
            } else {
              lastError = `HTTP ${healthResp.status}`;
              if (i < maxRetries - 1) {
                setOutput((prev) => prev + `[KNEZ] Health check returned ${healthResp.status}, retrying... (${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, retryDelay));
              }
            }
          } catch (error) {
            lastError = String(error).substring(0, 50);
            // Network error, retry with exponential backoff
            if (i < maxRetries - 1) {
              const backoffDelay = Math.min(retryDelay * Math.pow(1.5, i), 5000);
              setOutput((prev) => prev + `[KNEZ] Health check failed: ${lastError}, retrying in ${Math.round(backoffDelay)}ms... (${i + 1}/${maxRetries})`);
              await new Promise(r => setTimeout(r, backoffDelay));
            }
          }
        }

        if (!knezReady) {
          setOutput((prev) => prev + "\n[KNEZ] ✗ Failed to become ready after 30 attempts.");
          setOutput((prev) => prev + `[KNEZ] Last error: ${lastError}\n`);
          setOutput((prev) => prev + "[KNEZ] Please check:\n");
          setOutput((prev) => prev + "[KNEZ]   - KNEZ path is correct\n");
          setOutput((prev) => prev + "[KNEZ]   - Python is installed and accessible\n");
          setOutput((prev) => prev + "[KNEZ]   - Port 8000 is not in use by another application\n");
          setStatus("failed");
          isLaunching.current = false;
          return;
        }
        } // End of if (!knezAlreadyRunningLocal)
        else {
          setOutput((prev) => prev + "[KNEZ] Skipping startup - already running.\n");
        }
      } // End of if (!knezAlreadyRunning)

      // Warmup model to prevent first-request delay
      setOutput((prev) => prev + "\n[3/3] Loading model...");
      setOutput((prev) => prev + "[Model] Sending warmup request to load model into memory...");
      try {
        const knezPort = (import.meta.env.VITE_KNEZ_PORT as string) || "8000";
        const warmupResp = await fetch(`http://127.0.0.1:${knezPort}/system/load-model`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "qwen2.5:7b-instruct-q4_K_M"
          }),
          signal: AbortSignal.timeout(60000)
        });
        if (warmupResp.ok) {
          const data = await warmupResp.json();
          if (data.success) {
            setOutput((prev) => prev + "[Model] ✓ Model loaded successfully.\n");
          } else {
            setOutput((prev) => prev + `[Model] ⚠ Load failed: ${data.error || "unknown"}\n`);
          }
        } else {
          setOutput((prev) => prev + "[Model] ⚠ Warmup request failed (will load on first request).\n");
        }
      } catch (e) {
        setOutput((prev) => prev + `[Model] ⚠ Warmup failed: ${String(e)} (will load on first request).\n`);
      }

      // Set status to running since all components are up
      setStatus("running");
      setOutput((prev) => prev + "\n[Startup Complete] KNEZ local stack is ready.");
      isLaunching.current = false;
      if (startupTimeoutRef.current !== null) {
        clearTimeout(startupTimeoutRef.current);
        startupTimeoutRef.current = null;
      }
      if (onReady) onReady();

    } catch (e) {
      logger.error("system_orchestrator", "spawn_failed", { error: String(e) });
      setOutput((prev) => prev + `\n[Failed to spawn command] ${e}`);
      setStatus("failed");
      isLaunching.current = false;
      if (startupTimeoutRef.current !== null) {
        clearTimeout(startupTimeoutRef.current);
        startupTimeoutRef.current = null;
      }
    }
  }, [onReady, status]);

  const stopKnez = useCallback(async () => {
     try {
       setOutput((prev) => prev + "\n[Stop] Stopping KNEZ and Ollama...");
       isLaunching.current = false; // Reset launch guard to allow new startup
       const ollamaPort = (import.meta.env.VITE_OLLAMA_PORT as string) || "11434";
       const killScript =
         "$ErrorActionPreference='SilentlyContinue';" +
         "$k=(Get-NetTCPConnection -LocalPort 8000 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess);" +
         "if($k){Write-Host \"Killing KNEZ pid=$k\"; taskkill /PID $k /T /F | Out-Host}else{Write-Host \"No listener on 8000\"};" +
         `$o=(Get-NetTCPConnection -LocalPort ${ollamaPort} -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess);` +
         `if($o){Write-Host \"Killing Ollama pid=$o\"; taskkill /PID $o /T /F | Out-Host}else{Write-Host \"No listener on ${ollamaPort}\"}`;
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

       setStatus("idle"); // Set to idle to allow restart
       setOutput((prev) => prev + "\n[Stop] KNEZ and Ollama processes killed. Ready to restart.");
     } catch (e) {
       setOutput((prev) => prev + `\n[Stop Failed] ${e}`);
       isLaunching.current = false; // Reset on error too
       setStatus("idle");
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
      if (startupTimeoutRef.current !== null) {
        clearTimeout(startupTimeoutRef.current);
        startupTimeoutRef.current = null;
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
