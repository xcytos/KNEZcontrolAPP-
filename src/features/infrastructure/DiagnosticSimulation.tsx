import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, CheckCircle, XCircle, Clock, Zap, Activity } from 'lucide-react';

interface Coordinate {
  x: number;
  y: number;
}

interface RequestParticle {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  timestamp: number;
  path: Coordinate[];
  latency?: number;
  errorPath?: Coordinate[]; // Path of error propagation
  errorMessage?: string;
}

interface NodeHealth {
  id: string;
  status: 'healthy' | 'degraded' | 'failed';
  lastCheck: number;
  responseTime: number;
  errorRate: number;
  metrics: {
    cpu?: number;
    memory?: number;
    queueDepth?: number;
  };
}

interface SimulationConfig {
  speed: 'slow' | 'normal' | 'fast';
  autoRun: boolean;
  layerOrder: string[];
  checkInterval: number;
  alertThreshold: number; // Error rate threshold for alerts
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  nodeId: string;
  timestamp: number;
  acknowledged: boolean;
}

export const DiagnosticSimulation: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [particles, setParticles] = useState<RequestParticle[]>([]);
  const [nodeHealth, setNodeHealth] = useState<Map<string, NodeHealth>>(new Map());
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig>({
    speed: 'normal',
    autoRun: false,
    layerOrder: ['ui', 'service', 'backend', 'mcp'],
    checkInterval: 1000,
    alertThreshold: 50
  });
  const [currentLayer, setCurrentLayer] = useState(0);
  const [simulationResults, setSimulationResults] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particleIdRef = useRef(0);
  const alertIdRef = useRef(0);

  const speedMultiplier = {
    slow: 0.5,
    normal: 1,
    fast: 2
  };

  // Generate unique request ID
  const generateRequestId = useCallback((): string => {
    particleIdRef.current = particleIdRef.current + 1;
    return `req-${Date.now()}-${particleIdRef.current}`;
  }, []);

  // Generate alert
  const generateAlert = useCallback((type: 'critical' | 'warning' | 'info', message: string, nodeId: string): Alert => {
    alertIdRef.current = alertIdRef.current + 1;
    return {
      id: `alert-${Date.now()}-${alertIdRef.current}`,
      type,
      message,
      nodeId,
      timestamp: Date.now(),
      acknowledged: false
    };
  }, []);

  // Create request particle
  const createParticle = useCallback((startX: number, startY: number, targetX: number, targetY: number, color: string): RequestParticle => {
    return {
      id: generateRequestId(),
      x: startX,
      y: startY,
      targetX,
      targetY,
      color,
      status: 'pending',
      timestamp: Date.now(),
      path: [{ x: startX, y: startY }]
    };
  }, [generateRequestId]);

  // Simulate node health check
  const checkNodeHealth = useCallback(async (nodeId: string): Promise<NodeHealth> => {
    const startTime = Date.now();
    
    // Simulate real API call with random delays and failures
    const delay = Math.random() * 200 + 50; // 50-250ms
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const responseTime = Date.now() - startTime;
    const errorRate = Math.random() * 0.1; // 0-10% error rate
    const isError = Math.random() < errorRate;
    
    return {
      id: nodeId,
      status: isError ? 'failed' : (responseTime > 150 ? 'degraded' : 'healthy'),
      lastCheck: Date.now(),
      responseTime,
      errorRate,
      metrics: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        queueDepth: Math.floor(Math.random() * 10)
      }
    };
  }, []);

  // Run diagnostic on layer
  const runLayerDiagnostic = useCallback(async (layer: string) => {
    const nodes = getNodesForLayer(layer);
    const results: any[] = [];
    
    for (const node of nodes) {
      const health = await checkNodeHealth(node.id);
      setNodeHealth(prev => new Map(prev).set(node.id, health));
      results.push({ nodeId: node.id, layer, health });
      
      // Generate alerts for critical failures
      if (health.status === 'failed') {
        const alert = generateAlert('critical', `Node ${node.id} failed: ${health.errorRate.toFixed(1)}% error rate`, node.id);
        setAlerts(prev => [alert, ...prev]);
      } else if (health.status === 'degraded' && health.errorRate > simulationConfig.alertThreshold) {
        const alert = generateAlert('warning', `Node ${node.id} degraded: ${health.errorRate.toFixed(1)}% error rate`, node.id);
        setAlerts(prev => [alert, ...prev]);
      }
      
      // Create particle animation
      const particle = createParticle(node.x, node.y, node.x + 50, node.y, health.status === 'healthy' ? '#10b981' : '#ef4444');
      setParticles(prev => [...prev, particle]);
      
      await new Promise(resolve => setTimeout(resolve, simulationConfig.checkInterval / speedMultiplier[simulationConfig.speed]));
    }
    
    return results;
  }, [checkNodeHealth, createParticle, simulationConfig.checkInterval, simulationConfig.speed, simulationConfig.alertThreshold, generateAlert]);

  // Get nodes for layer (mock data)
  const getNodesForLayer = (layer: string) => {
    const nodes: any[] = [];
    const baseX = layer === 'ui' ? 100 : layer === 'service' ? 300 : layer === 'backend' ? 500 : 700;
    
    for (let i = 0; i < 3; i++) {
      nodes.push({
        id: `${layer}-node-${i}`,
        x: baseX,
        y: 100 + i * 100
      });
    }
    
    return nodes;
  };

  // Animation loop
  const animate = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw particles
    setParticles(prev => {
      const updated = prev.map(particle => {
        const dx = particle.targetX - particle.x;
        const dy = particle.targetY - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 5) {
          // Particle reached target
          return { ...particle, status: particle.status === 'pending' ? 'succeeded' : particle.status };
        }
        
        const speed = 2 * speedMultiplier[simulationConfig.speed];
        const newX = particle.x + (dx / distance) * speed;
        const newY = particle.y + (dy / distance) * speed;
        
        return { ...particle, x: newX, y: newY, path: [...particle.path, { x: newX, y: newY }] };
      });
      
      // Draw particles
      updated.forEach(particle => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
        
        // Draw glow effect
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = `${particle.color}33`;
        ctx.fill();
        
        // Draw path
        if (particle.path.length > 1) {
          ctx.beginPath();
          ctx.moveTo(particle.path[0].x, particle.path[0].y);
          particle.path.forEach(point => ctx.lineTo(point.x, point.y));
          ctx.strokeStyle = `${particle.color}66`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw error propagation path if failed
        if (particle.status === 'failed' && particle.errorPath && particle.errorPath.length > 1) {
          ctx.beginPath();
          ctx.moveTo(particle.errorPath[0].x, particle.errorPath[0].y);
          particle.errorPath.forEach(point => ctx.lineTo(point.x, point.y));
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
      
      // Remove completed particles after delay
      return updated.filter(p => p.status !== 'succeeded' || Date.now() - p.timestamp < 2000);
    });
    
    // Draw nodes with health status
    nodeHealth.forEach((health, nodeId) => {
      const node = getNodesForLayer(nodeId.split('-')[0]).find(n => n.id === nodeId);
      if (!node) return;
      
      // Draw node
      ctx.beginPath();
      ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = health.status === 'healthy' ? '#10b981' : health.status === 'degraded' ? '#f59e0b' : '#ef4444';
      ctx.fill();
      
      // Draw node border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw node label
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(nodeId, node.x, node.y + 35);
      
      // Draw metrics
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px sans-serif';
      ctx.fillText(`${health.responseTime}ms`, node.x, node.y + 45);
    });
    
    if (isRunning && !isPaused) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [isRunning, isPaused, simulationConfig.speed, nodeHealth]);

  // Start simulation
  const startSimulation = async () => {
    setIsRunning(true);
    setIsPaused(false);
    setParticles([]);
    setSimulationResults([]);
    setNodeHealth(new Map());
    
    // Run layer by layer
    for (let i = 0; i < simulationConfig.layerOrder.length; i++) {
      if (!isRunning) break;
      setCurrentLayer(i);
      
      const layer = simulationConfig.layerOrder[i];
      const results = await runLayerDiagnostic(layer);
      setSimulationResults(prev => [...prev, ...results]);
      
      await new Promise(resolve => setTimeout(resolve, 500 / speedMultiplier[simulationConfig.speed]));
    }
    
    setIsRunning(false);
    setCurrentLayer(0);
  };

  // Pause simulation
  const pauseSimulation = () => {
    setIsPaused(!isPaused);
  };

  // Stop simulation
  const stopSimulation = () => {
    setIsRunning(false);
    setIsPaused(false);
    setParticles([]);
  };

  // Reset simulation
  const resetSimulation = () => {
    stopSimulation();
    setSimulationResults([]);
    setNodeHealth(new Map());
    setCurrentLayer(0);
  };

  useEffect(() => {
    if (isRunning && !isPaused) {
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, isPaused, animate]);

  useEffect(() => {
    if (simulationConfig.autoRun) {
      startSimulation();
    }
  }, [simulationConfig.autoRun]);

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Diagnostic Simulation</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Real-time request flow visualization with node health monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Speed Control */}
          <select
            value={simulationConfig.speed}
            onChange={(e) => setSimulationConfig({ ...simulationConfig, speed: e.target.value as any })}
            className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-400 rounded border border-zinc-700"
          >
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
          
          {/* Controls */}
          <button
            onClick={startSimulation}
            disabled={isRunning}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Start
          </button>
          <button
            onClick={pauseSimulation}
            disabled={!isRunning}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors disabled:opacity-50"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={stopSimulation}
            disabled={!isRunning}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            Stop
          </button>
          <button
            onClick={resetSimulation}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            width={1000}
            height={600}
            className="w-full h-full bg-zinc-950"
          />
          
          {/* Layer Labels */}
          <div className="absolute top-4 left-4 flex gap-8">
            {simulationConfig.layerOrder.map((layer, index) => (
              <div key={layer} className="flex flex-col items-center">
                <div className={`px-3 py-1 rounded text-xs font-bold ${
                  index === currentLayer ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {layer.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
          
          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-zinc-800 rounded-lg p-4">
            <div className="text-xs font-bold text-zinc-300 mb-2">Status Legend</div>
            <div className="flex flex-col gap-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Healthy</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>Degraded</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Failed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="w-80 border-l border-zinc-800 bg-zinc-900 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Simulation Results
            </h3>
            
            {/* Summary */}
            <div className="mb-4 p-3 bg-zinc-800 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500">Active Requests:</span>
                  <span className="text-zinc-300 ml-2">{particles.length}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Total Checks:</span>
                  <span className="text-zinc-300 ml-2">{simulationResults.length}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Healthy:</span>
                  <span className="text-green-400 ml-2">
                    {simulationResults.filter(r => r.health.status === 'healthy').length}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Degraded:</span>
                  <span className="text-yellow-400 ml-2">
                    {simulationResults.filter(r => r.health.status === 'degraded').length}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Failed:</span>
                  <span className="text-red-400 ml-2">
                    {simulationResults.filter(r => r.health.status === 'failed').length}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Alerts:</span>
                  <span className="text-orange-400 ml-2">{alerts.length}</span>
                </div>
              </div>
            </div>

            {/* Alerts Section */}
            {alerts.length > 0 && (
              <div className="mb-4 p-3 bg-zinc-800 rounded-lg">
                <h4 className="text-xs font-bold text-zinc-300 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3" />
                  Recent Alerts
                </h4>
                <div className="space-y-2">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className={`p-2 rounded text-xs ${
                      alert.type === 'critical' ? 'bg-red-900/50 text-red-400' :
                      alert.type === 'warning' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-blue-900/50 text-blue-400'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{alert.nodeId}</span>
                        <span className="text-[10px] opacity-70">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1">{alert.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Detailed Results */}
            <div className="space-y-2">
              {simulationResults.map((result, index) => (
                <div key={index} className="p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-300">{result.nodeId}</span>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                      result.health.status === 'healthy' ? 'bg-green-900 text-green-400' :
                      result.health.status === 'degraded' ? 'bg-yellow-900 text-yellow-400' :
                      'bg-red-900 text-red-400'
                    }`}>
                      {result.health.status === 'healthy' && <CheckCircle className="w-3 h-3" />}
                      {result.health.status === 'degraded' && <AlertTriangle className="w-3 h-3" />}
                      {result.health.status === 'failed' && <XCircle className="w-3 h-3" />}
                      {result.health.status}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{result.health.responseTime}ms</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      <span>{result.health.errorRate.toFixed(1)}% err</span>
                    </div>
                  </div>
                  {result.health.metrics.cpu && (
                    <div className="mt-2 text-xs text-zinc-500">
                      CPU: {result.health.metrics.cpu.toFixed(0)}% | 
                      MEM: {result.health.metrics.memory?.toFixed(0)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
