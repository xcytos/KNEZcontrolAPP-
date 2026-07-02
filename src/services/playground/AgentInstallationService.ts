import { AgentStatus, AgentInstallProgress } from '../../domain/AgentTypes';
import { getAllAgents, getAgentById } from '../../playgrounds/AgentRegistry';

class AgentInstallationService {
  private statusCache: Map<string, AgentStatus> = new Map();
  private scanInProgress = false;

  async detectAgent(agentId: string): Promise<boolean> {
    const agent = getAgentById(agentId);
    if (!agent) return false;

    const cached = this.statusCache.get(agentId);
    if (cached && Date.now() - cached.lastCheck < 30000) {
      return cached.detected;
    }

    try {
      const { Command } = await import('@tauri-apps/plugin-shell');
      const result = await Command.create(agent.detectionCommand[0], agent.detectionCommand.slice(1)).execute();
      const detected = result.code === 0;

      this.statusCache.set(agentId, {
        id: agentId,
        installed: detected,
        detected,
        lastCheck: Date.now(),
      });

      return detected;
    } catch {
      this.statusCache.set(agentId, {
        id: agentId,
        installed: false,
        detected: false,
        lastCheck: Date.now(),
      });
      return false;
    }
  }

  async getAgentStatus(agentId: string): Promise<AgentStatus> {
    await this.detectAgent(agentId);
    return this.statusCache.get(agentId) || {
      id: agentId,
      installed: false,
      detected: false,
      lastCheck: Date.now(),
    };
  }

  async detectAllAgents(): Promise<Map<string, boolean>> {
    if (this.scanInProgress) {
      await new Promise<void>(resolve => {
        const check = () => {
          if (!this.scanInProgress) resolve();
          else setTimeout(check, 100);
        };
        check();
      });
      const results = new Map<string, boolean>();
      for (const agent of getAllAgents()) {
        const status = this.statusCache.get(agent.id);
        results.set(agent.id, status?.detected ?? false);
      }
      return results;
    }

    this.scanInProgress = true;
    const results = new Map<string, boolean>();

    const agents = getAllAgents();
    await Promise.allSettled(
      agents.map(async (agent) => {
        const detected = await this.detectAgent(agent.id);
        results.set(agent.id, detected);
      })
    );

    this.scanInProgress = false;
    return results;
  }

  async installAgent(
    agentId: string,
    onProgress?: (progress: AgentInstallProgress) => void
  ): Promise<boolean> {
    const agent = getAgentById(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    if (agent.installMethod === 'manual' || agent.installCommand.length === 0) {
      onProgress?.({
        agentId,
        phase: 'error',
        progress: 0,
        message: `Manual installation required. Visit ${agent.installUrl || agent.homepage}`,
      });
      return false;
    }

    try {
      onProgress?.({
        agentId,
        phase: 'installing',
        progress: 30,
        message: `Installing ${agent.name}...`,
      });

      const { Command } = await import('@tauri-apps/plugin-shell');
      const result = await Command.create(agent.installCommand[0], agent.installCommand.slice(1)).execute();

      if (result.code === 0) {
        onProgress?.({
          agentId,
          phase: 'verifying',
          progress: 80,
          message: 'Verifying installation...',
        });

        const detected = await this.detectAgent(agentId);

        if (detected) {
          onProgress?.({
            agentId,
            phase: 'done',
            progress: 100,
            message: `${agent.name} installed successfully`,
          });
          return true;
        }
      }

      onProgress?.({
        agentId,
        phase: 'error',
        progress: 0,
        message: result.stderr || `Installation failed with code ${result.code}`,
      });
      return false;
    } catch (error) {
      onProgress?.({
        agentId,
        phase: 'error',
        progress: 0,
        message: (error as Error).message,
      });
      return false;
    }
  }

  async getLaunchCommand(agentId: string): Promise<string[]> {
    const agent = getAgentById(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    return [...agent.launchCommand, ...(agent.launchArgs || [])];
  }

  clearCache(): void {
    this.statusCache.clear();
  }

  invalidateAgent(agentId: string): void {
    this.statusCache.delete(agentId);
  }
}

export const agentInstallationService = new AgentInstallationService();
