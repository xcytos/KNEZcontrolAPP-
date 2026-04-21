import React, { useEffect, useMemo, useState } from "react";
import { knezClient } from '../../services/knez/KnezClient';
import { KnezHealthResponse } from "../../domain/DataContracts";
import { HealthProbeStatus, SystemStatus } from "../system/useSystemOrchestrator";
import { isOverallHealthyStatus } from "../../utils/health";
import { Activity, Cpu, Database, Play, RefreshCw, Square, Zap } from "lucide-react";
import { ConnectionHealthMonitor, ConnectionHealthStatus } from '../../services/connection/ConnectionHealthMonitor';

// Status Types
type ComponentStatus = "unknown" | "healthy" | "degraded" | "unhealthy";

// Runtime Card Component
const RuntimeCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  status: ComponentStatus;
  metadata: Record<string, string>;
  actions?: React.ReactNode;
}> = ({ title, icon, status, metadata, actions }) => {
  const statusColors = {
    unknown: "bg-zinc-700 text-zinc-300",
    healthy: "bg-green-600 text-white",
    degraded: "bg-yellow-600 text-white",
    unhealthy: "bg-red-600 text-white",
  };
  
  return (
    <div className="border border-zinc-800 rounded-lg bg-zinc-950/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-mono text-sm text-zinc-300">{title}</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status]}`}>
          {status.toUpperCase()}
        </span>
      </div>
      <div className="p-4 space-y-2">
        {Object.entries(metadata).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">{key}</span>
            <span className="font-mono text-zinc-300">{value}</span>
          </div>
        ))}
        {actions && <div className="pt-2 mt-2 border-t border-zinc-800"> {actions} </div>}
      </div>
    </div>
  );
};

export const ConnectionPage: React.FC<{
  systemStatus: SystemStatus;
  systemOutput: string;
  systemHealthProbe: HealthProbeStatus;
  onForceStart?: (force?: boolean) => void;
  onStop?: () => void;
}> = ({ systemStatus, systemOutput, onForceStart, onStop }) => {
  const [endpoint, setEndpoint] = useState("http://127.0.0.1:8000");
  const [health, setHealth] = useState<KnezHealthResponse | null>(null);
  const [modelState, setModelState] = useState<"unloaded" | "loading" | "loaded">("unloaded");
  const [modelLoadingProgress, setModelLoadingProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"lifecycle" | "errors" | "raw">("lifecycle");
  const [isMounted, setIsMounted] = useState(true);
  const [connectionHealthStatus, setConnectionHealthStatus] = useState<ConnectionHealthStatus>("unknown");
  const w = window as any;
  const isTauri = !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const healthMonitorRef = React.useRef<ConnectionHealthMonitor | null>(null);
  const healthCheckDebounceRef = React.useRef<number | null>(null);

  // Load startup logs from localStorage on mount
  useEffect(() => {
    const savedLogs = localStorage.getItem('knez_startup_logs');
    if (savedLogs && systemOutput === "") {
      // Only load saved logs if current output is empty (fresh session)
      // This prevents overwriting current session logs
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsMounted(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (healthCheckDebounceRef.current) {
        clearTimeout(healthCheckDebounceRef.current);
      }
    };
  }, []);

  // Save startup logs to localStorage when they change
  useEffect(() => {
    if (systemOutput) {
      try {
        localStorage.setItem('knez_startup_logs', systemOutput);
      } catch (e) {
        // localStorage might be full or unavailable
        console.warn('Failed to save startup logs:', e);
      }
    }
  }, [systemOutput]);

  // Parse lifecycle and errors from system output
  const parseLifecycle = (output: string) => {
    const lines = output.split('\n').filter(l => l.trim());
    return lines.map((line, i) => ({ id: i, text: line, type: line.includes('✓') ? 'success' : line.includes('✗') ? 'error' : line.includes('⚠') ? 'warning' : 'info' }));
  };

  // Calculate model loading progress from output
  const calculateProgress = (output: string) => {
    const steps = [
      'System Check',
      'Ollama', 
      'KNEZ',
      'Health check',
      'Model warmup'
    ];
    let completed = 0;
    if (output.includes(`[System Check] ✓`) || output.includes(`[Ollama] ✓`) || 
        output.includes(`[KNEZ] ✓`) || output.includes(`[KNEZ] ✓ Health check passed`) ||
        output.includes(`[Model] ✓`)) {
      completed++;
    }
    return Math.round((completed / steps.length) * 100);
  };

  // Update progress when output changes
  useEffect(() => {
    setModelLoadingProgress(calculateProgress(systemOutput));
  }, [systemOutput]);

  const lifecycleSteps = useMemo(() => parseLifecycle(systemOutput), [systemOutput]);
  const errors = useMemo(() => lifecycleSteps.filter((s: any) => s.type === 'error'), [lifecycleSteps]);

  // Phase 5: Status Engine - derive statuses from actual backend state
  const knezStatus: ComponentStatus = useMemo(() => {
    if (!health) return "unknown";
    if (isOverallHealthyStatus(health.status)) {
      return health.ollama?.reachable ? "healthy" : "degraded";
    }
    return "unhealthy";
  }, [health]);

  const ollamaStatus: ComponentStatus = useMemo(() => {
    if (!health) return "unknown";
    return health.ollama?.reachable ? "healthy" : "unhealthy";
  }, [health]);

  const modelStatus: ComponentStatus = useMemo(() => {
    if (!health) return "unknown";
    if (modelState === "loaded") return "healthy";
    if (modelState === "loading") return "degraded";
    return "unhealthy";
  }, [modelState]);

  // Startup progress calculation
  const startupProgress = useMemo(() => {
    if (systemStatus === "idle") return 0;
    if (systemStatus === "running") return 100;
    if (systemStatus === "failed") return 0;
    // During startup, estimate progress based on output
    let progress = 0;
    if (systemOutput.includes("[1/2] Starting Ollama")) progress = 10;
    if (systemOutput.includes("[Ollama] ✓ Ready")) progress = 50;
    if (systemOutput.includes("[2/2] Starting KNEZ")) progress = 60;
    if (systemOutput.includes("[KNEZ] ✓ Health check passed")) progress = 90;
    if (systemOutput.includes("[Startup Complete]")) progress = 100;
    return progress;
  }, [systemStatus, systemOutput]);

  useEffect(() => {
    const profile = knezClient.getProfile();
    setEndpoint(profile.endpoint);
    checkModelState();
  }, []);

  // Refresh health state more frequently when system is running or failed
  useEffect(() => {
    if (systemStatus === "running" || systemStatus === "failed" || systemStatus === "starting") {
      // Immediate refresh
      checkModelState();
      
      // Then poll every 2 seconds to ensure status stays up-to-date
      const interval = setInterval(() => {
        checkModelState();
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [systemStatus]);

  // Initialize connection health monitor
  useEffect(() => {
    if (!healthMonitorRef.current) {
      healthMonitorRef.current = new ConnectionHealthMonitor({
        intervalMs: 5000, // Check every 5 seconds
        timeoutMs: 3000,
        failureThreshold: 3,
        recoveryThreshold: 2,
        healthCheckFn: async () => {
          try {
            const h = await knezClient.health({ timeoutMs: 3000 });
            return h && isOverallHealthyStatus(h.status);
          } catch {
            return false;
          }
        },
      });

      // Subscribe to health status changes
      const unsubscribe = healthMonitorRef.current.subscribe((state) => {
        if (isMounted) {
          setConnectionHealthStatus(state.status);
        }
      });

      // Start monitoring when system is running
      if (systemStatus === "running") {
        healthMonitorRef.current.start();
      }

      return () => {
        unsubscribe();
        healthMonitorRef.current?.stop();
      };
    }
  }, [systemStatus]);

  const checkModelState = async () => {
    // Clear any pending debounce timer
    if (healthCheckDebounceRef.current) {
      clearTimeout(healthCheckDebounceRef.current);
    }

    // Debounce the health check with 500ms delay
    healthCheckDebounceRef.current = window.setTimeout(async () => {
      // Abort previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      try {
        const h = await knezClient.health({ timeoutMs: 3000 });
        if (isMounted && h) {
          setHealth(h);
          setModelState(h.model_state?.state ?? "unloaded");
        }
      } catch (error) {
        if (isMounted && controller.signal.aborted !== true) {
          setModelState("unloaded");
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    }, 500);
  };

  const handleLoadModel = async () => {
    // First refresh health state to ensure we have current data
    await checkModelState();
    
    if (!health?.ollama?.reachable) {
      return;
    }
    if (!isMounted) return;
    
    setModelState("loading");
    try {
      const result = await knezClient.loadModel("qwen2.5:7b-instruct-q4_K_M");
      if (isMounted) {
        if (result.success) {
          setModelState("loaded");
          await checkModelState();
        } else {
          setModelState("unloaded");
        }
      }
    } catch (error) {
      if (isMounted) {
        setModelState("unloaded");
      }
    }
  };

  // Phase 4: Action System
  const canStart = systemStatus === "idle" || systemStatus === "failed";
  const canStop = systemStatus === "running" || systemStatus === "starting";
  const canReload = health?.ollama?.reachable && modelState === "unloaded";

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to start
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (canStart && onForceStart && isTauri) {
          onForceStart(true);
        }
      }
      // Ctrl/Cmd + Shift + S to stop
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (canStop && onStop) {
          onStop();
        }
      }
      // Ctrl/Cmd + R to restart
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if (systemStatus !== "starting" && onForceStart && isTauri) {
          onForceStart(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canStart, canStop, systemStatus, onForceStart, onStop, isTauri]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT COLUMN - Controls */}
      <div className="space-y-6">
        {/* System Overview Bar */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-950/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" />
              <span className="font-mono text-sm text-zinc-300">System Overview</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                connectionHealthStatus === "healthy" ? "bg-green-600 text-white" :
                connectionHealthStatus === "degraded" ? "bg-yellow-600 text-white" :
                connectionHealthStatus === "unhealthy" ? "bg-red-600 text-white" :
                "bg-zinc-700 text-zinc-300"
              }`}>
                Health: {connectionHealthStatus.toUpperCase()}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                systemStatus === "running" ? "bg-green-600 text-white" :
                systemStatus === "starting" ? "bg-yellow-600 text-white" :
                systemStatus === "failed" ? "bg-red-600 text-white" :
                "bg-zinc-700 text-zinc-300"
              }`}>
                {systemStatus.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="text-xs text-zinc-500 font-mono mb-2">{endpoint}</div>
          {/* Startup Progress Bar */}
          {systemStatus === "starting" && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>Starting up...</span>
                <span>{startupProgress}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1.5">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${startupProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Pipeline - Phase 4 */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-950/40 p-4">
          <div className="font-mono text-sm text-zinc-300 mb-4">Actions</div>
          <div className="space-y-2">
            {/* PRIMARY ACTION */}
            <button
              onClick={() => {
                if (!onForceStart) return;
                if (!isTauri) return;
                onForceStart(true); // Force start to bypass any stuck state
              }}
              disabled={!canStart}
              title={canStart ? "Start the KNEZ system" : "System is already running or starting"}
              className={`w-full px-4 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 ${
                canStart
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }`}
            >
              <Play className="w-4 h-4" />
              Start System
            </button>

            {/* SECONDARY ACTIONS */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  if (!onForceStart) return;
                  if (!isTauri) return;
                  onForceStart(true); // Force restart to bypass any stuck state
                }}
                disabled={systemStatus === "starting"}
                title={systemStatus === "starting" ? "Cannot restart during startup" : "Restart the system"}
                className={`px-3 py-2 text-xs rounded transition-colors flex items-center justify-center gap-1 ${
                  systemStatus === "starting"
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                }`}
              >
                <RefreshCw className="w-3 h-3" />
                Restart
              </button>
              <button
                onClick={onStop}
                disabled={!canStop}
                title={canStop ? "Stop the system" : "System is not running"}
                className={`px-3 py-2 text-xs rounded transition-colors flex items-center justify-center gap-1 ${
                  canStop
                    ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                }`}
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
              <button
                onClick={handleLoadModel}
                disabled={!canReload}
                title={canReload ? "Reload the model" : "Ollama not reachable or model already loaded"}
                className={`px-3 py-2 text-xs rounded transition-colors flex items-center justify-center gap-1 ${
                  canReload
                    ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                }`}
              >
                <Zap className="w-3 h-3" />
                Reload
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - Debug Panel + Status */}
      <div className="space-y-6">
        {/* Debug Panel - Always Visible */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-950/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
            <span className="font-mono text-xs text-zinc-400">Debug Panel</span>
          </div>
          <div className="flex border-b border-zinc-800">
            {(["lifecycle", "errors", "raw"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "text-blue-400 bg-zinc-800"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="p-4 h-64 overflow-y-auto">
            {activeTab === "lifecycle" && (
              <div className="space-y-1">
                {lifecycleSteps.length === 0 ? (
                  <div className="text-xs text-zinc-500">No lifecycle events yet.</div>
                ) : (
                  lifecycleSteps.map((step) => (
                    <div key={step.id} className={`text-xs font-mono p-1 rounded ${
                      step.type === 'success' ? 'text-green-400 bg-green-900/20' :
                      step.type === 'error' ? 'text-red-400 bg-red-900/20' :
                      step.type === 'warning' ? 'text-yellow-400 bg-yellow-900/20' :
                      'text-zinc-400 bg-zinc-800/50'
                    }`}>
                    {step.text}
                  </div>
                  ))
                )}
              </div>
            )}
            {activeTab === "errors" && (
              <div className="space-y-1">
                {errors.length === 0 ? (
                  <div className="text-xs text-green-400">No errors detected.</div>
                ) : (
                  errors.map((error) => (
                    <div key={error.id} className="text-xs font-mono text-red-400 bg-red-900/20 p-1 rounded">
                      {error.text}
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === "raw" && (
              <div className="text-xs font-mono text-zinc-400 whitespace-pre-wrap">
                {systemOutput ? (
                  systemOutput.split('\n').map((line, i) => {
                    // Syntax highlighting based on line content
                    let lineClass = 'text-zinc-400';
                    if (line.includes('✓')) lineClass = 'text-green-400';
                    else if (line.includes('✗')) lineClass = 'text-red-400';
                    else if (line.includes('⚠')) lineClass = 'text-yellow-400';
                    else if (line.includes('[Error]') || line.includes('[STDERR]')) lineClass = 'text-red-400';
                    else if (line.includes('[Ollama]') || line.includes('[KNEZ]') || line.includes('[Model]')) lineClass = 'text-blue-400';
                    else if (line.includes('[Startup]') || line.includes('[Stop]')) lineClass = 'text-purple-400';
                    else if (line.includes('[System Check]')) lineClass = 'text-cyan-400';
                    else if (line.includes('[Timeout]')) lineClass = 'text-orange-400';
                    
                    return (
                      <div key={i} className={lineClass}>
                        {line || ' '}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-zinc-500">No logs yet.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Model Loading Progress */}
        {systemStatus === "starting" && (
          <div className="mb-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Starting KNEZ...</span>
              <span className="text-sm font-mono text-blue-400">{modelLoadingProgress}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${modelLoadingProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Runtime Status Cards - Below Debug Panel */}
        <div className="space-y-4">
          <div className="font-mono text-sm text-zinc-300">Runtime Status</div>
          
          {/* KNEZ Backend Card */}
          <RuntimeCard
            title="KNEZ Backend"
            icon={<Cpu className="w-4 h-4 text-zinc-400" />}
            status={knezStatus}
            metadata={{
              endpoint: endpoint,
              trust: knezClient.getProfile().trustLevel,
            }}
          />

          {/* Ollama Runtime Card */}
          <RuntimeCard
            title="Ollama Runtime"
            icon={<Activity className="w-4 h-4 text-zinc-400" />}
            status={ollamaStatus}
            metadata={{
              reachable: health?.ollama?.reachable ? "YES" : "NO",
              endpoint: "localhost:11434",
            }}
            actions={
              !health?.ollama?.reachable && isTauri && onForceStart ? (
                <button
                  onClick={() => onForceStart(true)}
                  className="w-full px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs rounded transition-colors"
                >
                  Start Ollama
                </button>
              ) : null
            }
          />

          {/* Model State Card */}
          <RuntimeCard
            title="Model State"
            icon={<Database className="w-4 h-4 text-zinc-400" />}
            status={modelStatus}
            metadata={{
              name: "qwen2.5:7b-instruct-q4_K_M",
              state: modelState,
            }}
            actions={
              modelState === "unloaded" && health?.ollama?.reachable ? (
                <button
                  onClick={handleLoadModel}
                  className="w-full px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors"
                >
                  Load Model
                </button>
              ) : null
            }
          />
        </div>
      </div>
    </div>
  );
};
