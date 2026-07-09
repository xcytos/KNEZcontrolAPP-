import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Download,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Server,
  Plus,
} from 'lucide-react';
import { AgentDefinition, AgentInstallProgress, AGENT_PRESET_COLORS } from '../domain/AgentTypes';
import { getAllAgents } from './AgentRegistry';
import { agentInstallationService } from '../services/playground/AgentInstallationService';
import { nineRouterService } from '../services/router/NineRouterService';
import { PlaygroundSDK } from '../services/playground/PlaygroundSDK';

interface AgentManagerPanelProps {
  sdk: PlaygroundSDK;
  onLaunch?: (agent: AgentDefinition) => void;
}

export const AgentManagerPanel: React.FC<AgentManagerPanelProps> = ({ sdk: _sdk, onLaunch }) => {
  const [agents] = useState<AgentDefinition[]>(() => getAllAgents());
  const [statusMap, setStatusMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<AgentInstallProgress | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [nineRouterHealth, setNineRouterHealth] = useState<boolean>(false);
  const [showAll, setShowAll] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  useEffect(() => {
    console.log(`[AgentManagerPanel] mount: ${agents.length} agents in registry`);
    detectAll();
    checkNineRouter();
  }, []);

  const detectAll = async () => {
    setLoading(true);
    setDetectError(null);
    console.log(`[AgentManagerPanel] detectAll: starting scan`);
    try {
      const results = await agentInstallationService.detectAllAgents();
      console.log(`[AgentManagerPanel] detectAll: results=`, Object.fromEntries(results));
      setStatusMap(results);
      const anyDetected = Array.from(results.values()).some(v => v);
      if (!anyDetected) {
        setDetectError('No agents detected. Make sure the app is running in Tauri and agents are installed.');
      }
    } catch (error) {
      const msg = (error as Error).message || 'Detection failed';
      setDetectError(msg);
      console.error('[AgentManagerPanel] Detection failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkNineRouter = async () => {
    console.log(`[AgentManagerPanel] checkNineRouter: pinging...`);
    try {
      const health = await nineRouterService.checkHealth();
      console.log(`[AgentManagerPanel] checkNineRouter: health=`, health);
      setNineRouterHealth(health?.status === 'healthy');
    } catch (err) {
      console.log(`[AgentManagerPanel] checkNineRouter: failed -`, err);
      setNineRouterHealth(false);
    }
  };

  const handleInstall = async (agent: AgentDefinition) => {
    console.log(`[AgentManagerPanel] handleInstall: starting ${agent.id} (${agent.name})`);
    setInstalling(agent.id);
    setInstallProgress(null);
    try {
      const success = await agentInstallationService.installAgent(agent.id, (progress) => {
        console.log(`[AgentManagerPanel] install progress: ${agent.id} phase=${progress.phase} ${progress.progress}% "${progress.message}"`);
        setInstallProgress(progress);
      });
      console.log(`[AgentManagerPanel] handleInstall: ${agent.id} → success=${success}`);
      if (success) {
        setStatusMap(prev => new Map(prev).set(agent.id, true));
        agentInstallationService.invalidateAgent(agent.id);
      }
    } catch (error) {
      console.error(`[AgentManagerPanel] Install failed for ${agent.id}:`, error);
    } finally {
      setInstalling(null);
      setInstallProgress(null);
    }
  };

  const handleLaunch = (agent: AgentDefinition) => {
    console.log(`[AgentManagerPanel] handleLaunch: ${agent.id} (${agent.name})`);
    onLaunch?.(agent);
  };

  const toggleAgent = (agentId: string) => {
    setExpandedAgent(prev => prev === agentId ? null : agentId);
  };

  const displayedAgents = showAll ? agents : agents.filter(a => statusMap.get(a.id));

  const getAgentColor = (agent: AgentDefinition): string => {
    return AGENT_PRESET_COLORS[agent.id] || agent.color || '#6366f1';
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#8b949e', fontSize: '14px' }}>Detecting installed agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: '#0d1117', padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e6edf3', margin: 0 }}>AI Agent Playgrounds</h1>
          <p style={{ fontSize: '13px', color: '#8b949e', marginTop: '4px' }}>
            Install and launch CLI AI coding agents in dedicated playgrounds
          </p>
        </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px',
              backgroundColor: nineRouterHealth ? '#1a3a2a' : '#3a1a1a', fontSize: '11px', fontWeight: 500,
              color: nineRouterHealth ? '#3fb950' : '#f85149', border: `1px solid ${nineRouterHealth ? '#2ea043' : '#f85149'}40`,
            }}>
              <Server size={12} />
              NineRouter: {nineRouterHealth ? 'Connected' : 'Offline'}
            </div>
            <button
              onClick={() => setShowAll(p => !p)}
              style={{
                padding: '6px 10px', fontSize: '12px', fontWeight: 500,
                backgroundColor: showAll ? '#1f6feb' : '#21262d', color: '#ffffff',
                border: `1px solid ${showAll ? '#1f6feb' : '#30363d'}`, borderRadius: '6px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <Plus size={12} />
              {showAll ? 'Show Installed' : 'Add Agents'}
            </button>
            <button
              onClick={detectAll}
              style={{
                padding: '6px 10px', fontSize: '12px', backgroundColor: '#21262d', color: '#c9d1d9',
                border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <RefreshCw size={12} />
              Rescan
            </button>
          </div>
      </div>

      {/* Detection Error */}
      {!showAll && !loading && agents.filter(a => statusMap.get(a.id)).length === 0 && (
        <div style={{
          marginBottom: '16px', padding: '20px', borderRadius: '8px', textAlign: 'center',
          backgroundColor: '#161b22', border: '1px solid #30363d',
        }}>
          <p style={{ fontSize: '14px', color: '#8b949e', margin: 0 }}>
            No installed agents found. Click "Add Agents" to install CLI tools.
          </p>
        </div>
      )}

      {detectError && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
          backgroundColor: '#3a1a1a', border: '1px solid #f8514940',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <XCircle size={14} color="#f85149" />
          <span style={{ fontSize: '13px', color: '#f85149' }}>{detectError}</span>
        </div>
      )}

      {/* Install Progress */}
      {installProgress && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
          backgroundColor: '#161b22', border: '1px solid #30363d',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            {installProgress.phase === 'downloading' && <RefreshCw className="animate-spin" size={14} />}
            {installProgress.phase === 'installing' && <RefreshCw className="animate-spin" size={14} />}
            {installProgress.phase === 'verifying' && <RefreshCw className="animate-spin" size={14} />}
            {installProgress.phase === 'done' && <CheckCircle size={14} color="#3fb950" />}
            {installProgress.phase === 'error' && <XCircle size={14} color="#f85149" />}
            <span style={{ fontSize: '13px', color: '#c9d1d9' }}>{installProgress.message}</span>
          </div>
          <div style={{ height: '4px', backgroundColor: '#21262d', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '2px', transition: 'width 0.3s ease',
              backgroundColor: installProgress.phase === 'error' ? '#f85149' : '#2ea043',
              width: `${installProgress.progress}%`,
            }} />
          </div>
        </div>
      )}

      {/* Agent Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
        {displayedAgents.map((agent) => {
          const isInstalled = statusMap.get(agent.id) ?? false;
          const isInstalling = installing === agent.id;
          const isExpanded = expandedAgent === agent.id;
          const color = getAgentColor(agent);

          return (
            <div
              key={agent.id}
              style={{
                borderRadius: '8px', border: `1px solid ${isExpanded ? `${color}40` : '#30363d'}`,
                backgroundColor: '#161b22', overflow: 'hidden', transition: 'border-color 0.2s',
              }}
            >
              {/* Agent Card */}
              <div
                onClick={() => toggleAgent(agent.id)}
                style={{
                  padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: `${color}15`, fontSize: '20px', flexShrink: 0,
                }}>
                  {agent.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#e6edf3' }}>{agent.name}</span>
                    <span style={{
                      display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: isInstalled ? '#3fb950' : '#6e7681', flexShrink: 0,
                    }} />
                  </div>
                  <div style={{ fontSize: '12px', color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {agent.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{
                      padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 500,
                      backgroundColor: isInstalled ? '#1a3a2a' : '#21262d',
                      color: isInstalled ? '#3fb950' : '#8b949e',
                      border: `1px solid ${isInstalled ? '#2ea043' : '#30363d'}`,
                    }}>
                      {isInstalled ? 'Installed' : 'Not Installed'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#6e7681' }}>
                      {agent.installMethod === 'npm' ? 'npm' : agent.installMethod === 'pip' ? 'pip' : agent.installMethod}
                    </span>
                  </div>
                </div>

                {/* Expand Icon */}
                <div style={{ color: '#6e7681', flexShrink: 0 }}>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid #30363d', padding: '12px 14px' }}>
                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    {isInstalled ? (
                      <button
                        onClick={() => handleLaunch(agent)}
                        style={{
                          flex: 1, padding: '8px 12px', fontSize: '12px', fontWeight: 600,
                          backgroundColor: '#238636', color: '#ffffff', border: 'none', borderRadius: '6px',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}
                      >
                        <Play size={14} />
                        Launch
                      </button>
                    ) : (
                      <button
                        onClick={() => handleInstall(agent)}
                        disabled={isInstalling || agent.installMethod === 'manual'}
                        style={{
                          flex: 1, padding: '8px 12px', fontSize: '12px', fontWeight: 600,
                          backgroundColor: isInstalling ? '#21262d' : '#1f6feb', color: '#ffffff',
                          border: 'none', borderRadius: '6px', cursor: isInstalling ? 'wait' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          opacity: agent.installMethod === 'manual' ? 0.5 : 1,
                        }}
                      >
                        {isInstalling ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                        {isInstalling ? 'Installing...' : agent.installMethod === 'manual' ? 'Manual Install' : 'Install'}
                      </button>
                    )}

                  </div>

                  {/* Install Info for manual agents */}
                  {agent.installMethod === 'manual' && agent.installUrl && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#d29922' }}>
                      <AlertCircle size={12} />
                      <span>
                        Manual install:&nbsp;
                        <a
                          href={agent.installUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#58a6ff', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                          {agent.installUrl}
                        </a>
                      </span>
                    </div>
                  )}

                  {agent.postInstallNotes && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#8b949e' }}>
                      <span style={{ color: '#d29922' }}>Note:</span> {agent.postInstallNotes}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgentManagerPanel;
