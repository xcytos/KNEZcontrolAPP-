import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Activity, 
  Settings, 
  ToggleLeft, 
  ToggleRight,
  Play,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Layers,
  Search,
  Maximize2,
  Minimize2,
  X,
  RefreshCw
} from 'lucide-react';

export interface DiagnosticMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  history: number[];
  lastUpdated: number;
}

export interface LayerDiagnostic {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'failed';
  metrics: DiagnosticMetric[];
  nodes: NodeDiagnostic[];
  lastCheck: number;
}

export interface NodeDiagnostic {
  id: string;
  name: string;
  type: 'input' | 'decision' | 'execution' | 'memory' | 'governance' | 'infra';
  status: 'active' | 'inactive' | 'error';
  responseTime: number;
  throughput: number;
  errorRate: number;
  metrics: DiagnosticMetric[];
}

export interface DiagnosticConfig {
  samplingRate: number; // milliseconds
  historyLength: number;
  alertThreshold: number;
  autoRefresh: boolean;
  enabledLayers: string[];
  enabledMetrics: string[];
}

interface DiagnosticPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRunDiagnostic?: (config: DiagnosticConfig) => Promise<LayerDiagnostic[]>;
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({ 
  isOpen, 
  onClose,
  onRunDiagnostic 
}) => {
  const [config, setConfig] = useState<DiagnosticConfig>({
    samplingRate: 1000,
    historyLength: 60,
    alertThreshold: 80,
    autoRefresh: true,
    enabledLayers: ['ui', 'service', 'backend', 'mcp'],
    enabledMetrics: ['responseTime', 'throughput', 'errorRate', 'cpu', 'memory']
  });

  const [diagnostics, setDiagnostics] = useState<LayerDiagnostic[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [windowMode, setWindowMode] = useState<'compact' | 'expanded' | 'fullscreen'>('expanded');
  const [activeTab, setActiveTab] = useState<'overview' | 'layers' | 'nodes' | 'metrics' | 'alerts'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'healthy' | 'degraded' | 'failed'>('all');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Simulate diagnostic data (replace with real data from onRunDiagnostic)
  const runDiagnostic = useCallback(async () => {
    if (!onRunDiagnostic) {
      // Generate mock data for demo
      const mockDiagnostics: LayerDiagnostic[] = [
        {
          id: 'ui',
          name: 'UI Layer',
          status: 'healthy',
          lastCheck: Date.now(),
          metrics: [
            { id: 'renderTime', name: 'Render Time', value: 16, unit: 'ms', threshold: 50, status: 'healthy', history: [], lastUpdated: Date.now() },
            { id: 'fps', name: 'FPS', value: 60, unit: 'fps', threshold: 30, status: 'healthy', history: [], lastUpdated: Date.now() }
          ],
          nodes: [
            { id: 'chatPane', name: 'ChatPane', type: 'input', status: 'active', responseTime: 12, throughput: 100, errorRate: 0, metrics: [] },
            { id: 'connectionPage', name: 'ConnectionPage', type: 'input', status: 'active', responseTime: 8, throughput: 50, errorRate: 0, metrics: [] }
          ]
        },
        {
          id: 'service',
          name: 'Service Layer',
          status: 'healthy',
          lastCheck: Date.now(),
          metrics: [
            { id: 'apiLatency', name: 'API Latency', value: 45, unit: 'ms', threshold: 200, status: 'healthy', history: [], lastUpdated: Date.now() },
            { id: 'requestRate', name: 'Request Rate', value: 150, unit: 'req/s', threshold: 1000, status: 'healthy', history: [], lastUpdated: Date.now() }
          ],
          nodes: [
            { id: 'chatService', name: 'ChatService', type: 'execution', status: 'active', responseTime: 25, throughput: 80, errorRate: 0.01, metrics: [] },
            { id: 'knezClient', name: 'KnezClient', type: 'execution', status: 'active', responseTime: 30, throughput: 60, errorRate: 0, metrics: [] }
          ]
        },
        {
          id: 'backend',
          name: 'Backend Layer',
          status: 'degraded',
          lastCheck: Date.now(),
          metrics: [
            { id: 'cpuUsage', name: 'CPU Usage', value: 75, unit: '%', threshold: 80, status: 'warning', history: [], lastUpdated: Date.now() },
            { id: 'memoryUsage', name: 'Memory Usage', value: 82, unit: '%', threshold: 85, status: 'warning', history: [], lastUpdated: Date.now() }
          ],
          nodes: [
            { id: 'knezBackend', name: 'KNEZ Backend', type: 'infra', status: 'active', responseTime: 45, throughput: 40, errorRate: 0.05, metrics: [] },
            { id: 'ollama', name: 'Ollama', type: 'infra', status: 'active', responseTime: 120, throughput: 20, errorRate: 0, metrics: [] }
          ]
        },
        {
          id: 'mcp',
          name: 'MCP Layer',
          status: 'healthy',
          lastCheck: Date.now(),
          metrics: [
            { id: 'toolLatency', name: 'Tool Latency', value: 200, unit: 'ms', threshold: 500, status: 'healthy', history: [], lastUpdated: Date.now() },
            { id: 'activeTools', name: 'Active Tools', value: 12, unit: 'count', threshold: 50, status: 'healthy', history: [], lastUpdated: Date.now() }
          ],
          nodes: [
            { id: 'mcpHost', name: 'MCP Host', type: 'infra', status: 'active', responseTime: 15, throughput: 30, errorRate: 0, metrics: [] },
            { id: 'taqwin', name: 'Taqwin', type: 'governance', status: 'active', responseTime: 25, throughput: 25, errorRate: 0, metrics: [] }
          ]
        }
      ];
      setDiagnostics(mockDiagnostics);
      return;
    }

    const results = await onRunDiagnostic(config);
    setDiagnostics(results);
  }, [config, onRunDiagnostic]);

  useEffect(() => {
    if (isOpen && config.autoRefresh) {
      runDiagnostic();
      intervalRef.current = setInterval(runDiagnostic, config.samplingRate);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOpen, config.autoRefresh, config.samplingRate, runDiagnostic]);

  const handleToggleAutoRefresh = () => {
    setConfig(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }));
  };

  const handleSamplingRateChange = (value: number) => {
    setConfig(prev => ({ ...prev, samplingRate: value }));
  };

  const handleAlertThresholdChange = (value: number) => {
    setConfig(prev => ({ ...prev, alertThreshold: value }));
  };

  const handleRunNow = async () => {
    setIsRunning(true);
    await runDiagnostic();
    setIsRunning(false);
  };

  const handleExportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagnostic-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedConfig = JSON.parse(e.target?.result as string);
        setConfig(importedConfig);
      } catch (error) {
        console.error('Failed to import config:', error);
      }
    };
    reader.onerror = (error) => {
      console.error('Failed to read file:', error);
    };
    reader.readAsText(file);
  };

  const filteredDiagnostics = diagnostics.filter(layer => {
    if (filterStatus !== 'all' && layer.status !== filterStatus) return false;
    if (searchQuery && !layer.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'critical': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'degraded': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 bg-black/50 flex items-center justify-center ${
      windowMode === 'fullscreen' ? 'p-0' : 'p-4'
    }`}>
      <div className={`bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl flex flex-col ${
        windowMode === 'fullscreen' ? 'w-full h-full rounded-none' : 
        windowMode === 'expanded' ? 'w-[1400px] h-[900px]' : 
        'w-[900px] h-[600px]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-lg font-bold text-zinc-100">System Diagnostic Center</h2>
              <p className="text-xs text-zinc-500">Real-time infrastructure monitoring and analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWindowMode(windowMode === 'fullscreen' ? 'expanded' : 'fullscreen')}
              className="p-2 hover:bg-zinc-800 rounded transition-colors"
              title={windowMode === 'fullscreen' ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {windowMode === 'fullscreen' ? <Minimize2 className="w-4 h-4 text-zinc-400" /> : <Maximize2 className="w-4 h-4 text-zinc-400" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <button
              onClick={handleRunNow}
              disabled={isRunning}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded text-sm transition-colors"
            >
              {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Diagnostic
            </button>
            <button
              onClick={handleToggleAutoRefresh}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                config.autoRefresh ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
              }`}
            >
              {config.autoRefresh ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              Auto-Refresh
            </button>
            <button
              onClick={handleExportConfig}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-sm transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Import
              <input
                type="file"
                accept=".json"
                onChange={(e) => e.target.files?.[0] && handleImportConfig(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Clock className="w-3 h-3" />
              <span>Sample Rate: {config.samplingRate}ms</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Zap className="w-3 h-3" />
              <span>Threshold: {config.alertThreshold}%</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-6 border-b border-zinc-800 bg-zinc-950">
          {['overview', 'layers', 'nodes', 'metrics', 'alerts'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab 
                  ? 'text-blue-400 border-b-2 border-blue-400' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500">Total Layers</span>
                      <Layers className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="text-2xl font-bold text-zinc-100">{diagnostics.length}</div>
                  </div>
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500">Healthy</span>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="text-2xl font-bold text-green-400">
                      {diagnostics.filter(d => d.status === 'healthy').length}
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500">Degraded</span>
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="text-2xl font-bold text-orange-400">
                      {diagnostics.filter(d => d.status === 'degraded').length}
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500">Failed</span>
                      <XCircle className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="text-2xl font-bold text-red-400">
                      {diagnostics.filter(d => d.status === 'failed').length}
                    </div>
                  </div>
                </div>

                {/* Layer Status */}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-zinc-100 mb-4">Layer Status</h3>
                  <div className="space-y-3">
                    {diagnostics.map((layer) => (
                      <div
                        key={layer.id}
                        onClick={() => setSelectedLayer(layer.id)}
                        className={`flex items-center justify-between p-3 rounded cursor-pointer transition-colors ${
                          selectedLayer === layer.id ? 'bg-zinc-700' : 'bg-zinc-800/50 hover:bg-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(layer.status)}
                          <span className="text-sm font-medium text-zinc-300">{layer.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-zinc-500">{layer.nodes.length} nodes</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(layer.status)}`}>
                            {layer.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'layers' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search layers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
                  >
                    <option value="all">All Status</option>
                    <option value="healthy">Healthy</option>
                    <option value="degraded">Degraded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                {filteredDiagnostics.map((layer) => (
                  <div key={layer.id} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(layer.status)}
                        <div>
                          <h4 className="text-sm font-bold text-zinc-100">{layer.name}</h4>
                          <p className="text-xs text-zinc-500">Last check: {new Date(layer.lastCheck).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(layer.status)}`}>
                        {layer.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {layer.metrics.map((metric) => (
                        <div key={metric.id} className="bg-zinc-900/50 border border-zinc-700 rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-zinc-500">{metric.name}</span>
                            {getStatusIcon(metric.status)}
                          </div>
                          <div className="text-lg font-bold text-zinc-100">
                            {metric.value} <span className="text-xs text-zinc-500">{metric.unit}</span>
                          </div>
                          <div className="mt-2 h-1 bg-zinc-800 rounded overflow-hidden">
                            <div 
                              className={`h-full ${metric.status === 'healthy' ? 'bg-green-500' : metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${(metric.value / metric.threshold) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Nodes */}
                    <div className="border-t border-zinc-700 pt-3">
                      <h5 className="text-xs font-bold text-zinc-400 mb-2">Nodes</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {layer.nodes.map((node) => (
                          <div key={node.id} className="bg-zinc-900/50 border border-zinc-700 rounded p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-zinc-300">{node.name}</span>
                              <span className={`w-2 h-2 rounded-full ${
                                node.status === 'active' ? 'bg-green-500' : 
                                node.status === 'inactive' ? 'bg-zinc-500' : 'bg-red-500'
                              }`} />
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                              <span>RT: {node.responseTime}ms</span>
                              <span>TP: {node.throughput}/s</span>
                              <span>ERR: {(node.errorRate * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'nodes' && (
              <div className="space-y-4">
                {diagnostics.map((layer) => (
                  <div key={layer.id} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-zinc-100 mb-4">{layer.name}</h3>
                    <div className="space-y-3">
                      {layer.nodes.map((node) => (
                        <div
                          key={node.id}
                          onClick={() => setSelectedNode(node.id)}
                          className={`flex items-center justify-between p-3 rounded cursor-pointer transition-colors ${
                            selectedNode === node.id ? 'bg-zinc-700' : 'bg-zinc-900/50 hover:bg-zinc-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              node.status === 'active' ? 'bg-green-500' : 
                              node.status === 'inactive' ? 'bg-zinc-500' : 'bg-red-500'
                            }`} />
                            <div>
                              <span className="text-sm font-medium text-zinc-300">{node.name}</span>
                              <span className="text-xs text-zinc-500 ml-2">({node.type})</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-zinc-500">
                            <span>RT: {node.responseTime}ms</span>
                            <span>TP: {node.throughput}/s</span>
                            <span>ERR: {(node.errorRate * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'metrics' && (
              <div className="space-y-4">
                {diagnostics.map((layer) => (
                  <div key={layer.id} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-zinc-100 mb-4">{layer.name}</h3>
                    <div className="space-y-3">
                      {layer.metrics.map((metric) => (
                        <div key={metric.id} className="bg-zinc-900/50 border border-zinc-700 rounded p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(metric.status)}
                              <div>
                                <span className="text-sm font-medium text-zinc-300">{metric.name}</span>
                                <span className="text-xs text-zinc-500 ml-2">ID: {metric.id}</span>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(metric.status)}`}>
                              {metric.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-zinc-500">Current Value</span>
                                <span className="text-lg font-bold text-zinc-100">
                                  {metric.value} <span className="text-xs text-zinc-500">{metric.unit}</span>
                                </span>
                              </div>
                              <div className="h-2 bg-zinc-800 rounded overflow-hidden">
                                <div 
                                  className={`h-full ${metric.status === 'healthy' ? 'bg-green-500' : metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${(metric.value / metric.threshold) * 100}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-xs text-zinc-500">
                              <div>Threshold: {metric.threshold} {metric.unit}</div>
                              <div>Last Updated: {new Date(metric.lastUpdated).toLocaleTimeString()}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="space-y-4">
                {diagnostics.flatMap(layer => 
                  layer.metrics.filter(m => m.status !== 'healthy').map(metric => ({
                    layer: layer.name,
                    metric
                  }))
                ).map((alert, idx) => (
                  <div key={idx} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`w-5 h-5 ${alert.metric.status === 'warning' ? 'text-yellow-500' : 'text-red-500'}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-zinc-100">{alert.layer}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(alert.metric.status)}`}>
                            {alert.metric.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">
                          {alert.metric.name}: {alert.metric.value} {alert.metric.unit} (threshold: {alert.metric.threshold} {alert.metric.unit})
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar - Configuration */}
          <div className="w-80 border-l border-zinc-800 bg-zinc-950 p-4 overflow-auto">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-bold text-zinc-100">Configuration</h3>
            </div>

            <div className="space-y-6">
              {/* Sampling Rate Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-400">Sampling Rate</label>
                  <span className="text-xs text-zinc-300">{config.samplingRate}ms</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="10000"
                  step="100"
                  value={config.samplingRate}
                  onChange={(e) => handleSamplingRateChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                  <span>100ms</span>
                  <span>10s</span>
                </div>
              </div>

              {/* Alert Threshold Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-400">Alert Threshold</label>
                  <span className="text-xs text-zinc-300">{config.alertThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={config.alertThreshold}
                  onChange={(e) => handleAlertThresholdChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                  <span>10%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* History Length Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-400">History Length</label>
                  <span className="text-xs text-zinc-300">{config.historyLength}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="10"
                  value={config.historyLength}
                  onChange={(e) => setConfig(prev => ({ ...prev, historyLength: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                  <span>10</span>
                  <span>300</span>
                </div>
              </div>

              {/* Layer Toggles */}
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Enabled Layers</label>
                <div className="space-y-2">
                  {['ui', 'service', 'backend', 'mcp'].map((layer) => (
                    <div key={layer} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-300 capitalize">{layer}</span>
                      <button
                        onClick={() => {
                          setConfig(prev => ({
                            ...prev,
                            enabledLayers: prev.enabledLayers.includes(layer)
                              ? prev.enabledLayers.filter(l => l !== layer)
                              : [...prev.enabledLayers, layer]
                          }));
                        }}
                        className={`w-10 h-5 rounded-full transition-colors ${
                          config.enabledLayers.includes(layer) ? 'bg-blue-600' : 'bg-zinc-700'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                          config.enabledLayers.includes(layer) ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metric Toggles */}
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Enabled Metrics</label>
                <div className="space-y-2">
                  {['responseTime', 'throughput', 'errorRate', 'cpu', 'memory'].map((metric) => (
                    <div key={metric} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-300 capitalize">{metric}</span>
                      <button
                        onClick={() => {
                          setConfig(prev => ({
                            ...prev,
                            enabledMetrics: prev.enabledMetrics.includes(metric)
                              ? prev.enabledMetrics.filter(m => m !== metric)
                              : [...prev.enabledMetrics, metric]
                          }));
                        }}
                        className={`w-10 h-5 rounded-full transition-colors ${
                          config.enabledMetrics.includes(metric) ? 'bg-blue-600' : 'bg-zinc-700'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                          config.enabledMetrics.includes(metric) ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-zinc-950 text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            <span>Status: {isRunning ? 'Running...' : 'Idle'}</span>
            <span>Last Update: {diagnostics.length > 0 ? new Date(diagnostics[0].lastCheck).toLocaleTimeString() : 'Never'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3" />
            <span>Diagnostic System v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
