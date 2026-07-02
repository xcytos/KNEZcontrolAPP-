import { AgentStatus, AgentInstallProgress } from '../../domain/AgentTypes';
import { getAllAgents, getAgentById } from '../../playgrounds/AgentRegistry';

const isWindows = navigator.userAgent.includes('Windows');

/**
 * Maps raw binary names to Tauri v2 scoped command names defined in capabilities.
 */
function scopeName(bin: string): string {
  const map: Record<string, string> = {
    'cmd.exe': 'cmd',
    'powershell.exe': 'powershell',
    'npm': 'npm',
    'npm.cmd': 'npm-cmd',
    'node': 'node',
    'node.exe': 'node-exe',
    'pip': 'pip',
    'pip.exe': 'pip-exe',
    'python': 'python',
    'python.exe': 'python-exe',
    'where': 'where',
    'which': 'which',
    'taskkill': 'exec',
  };
  return map[bin] || bin;
}

class AgentInstallationService {
  private statusCache: Map<string, AgentStatus> = new Map();
  private scanInProgress = false;

  private async detectViaShell(agentId: string): Promise<boolean> {
    const agent = getAgentById(agentId);
    if (!agent) {
      console.log(`[AgentInstallationService] detectViaShell: agent ${agentId} not found in registry`);
      return false;
    }

    const name = agent.detectionCommand[0];
    console.log(`[AgentInstallationService] detectViaShell: starting detection for ${agentId} (${agent.name}), binary="${name}"`);

    try {
      const { Command } = await import('@tauri-apps/plugin-shell');

      // 1. If agent has a known absolute path, check it via shell
      if (agent.detectionPath) {
        console.log(`[AgentInstallationService] detectViaShell: tier 1 - checking detectionPath: ${agent.detectionPath}`);
        try {
          let pathResult;
          if (isWindows) {
            const escapedPath = agent.detectionPath.includes(' ') ? `"${agent.detectionPath}"` : agent.detectionPath;
            pathResult = await Command.create(scopeName('cmd.exe'), ['/c', 'if', 'exist', escapedPath, 'echo', 'found']).execute();
          } else {
            pathResult = await Command.create(scopeName('which'), ['-f', agent.detectionPath]).execute();
          }
          console.log(`[AgentInstallationService] detectViaShell: tier 1 result - code=${pathResult.code}, stdout="${pathResult.stdout?.trim()}", stderr="${pathResult.stderr?.trim()}"`);
          if (pathResult.code === 0 && pathResult.stdout?.trim()) {
            console.log(`[AgentInstallationService] detectViaShell: ${agentId} DETECTED via detectionPath`);
            return true;
          }
          console.log(`[AgentInstallationService] detectViaShell: tier 1 miss, falling through`);
        } catch (err) {
          console.log(`[AgentInstallationService] detectViaShell: tier 1 threw:`, err);
        }
      } else {
        console.log(`[AgentInstallationService] detectViaShell: no detectionPath for ${agentId}, skipping tier 1`);
      }

      // 2. Try PATH-based detection via `where` / `which`
      console.log(`[AgentInstallationService] detectViaShell: tier 2 - checking PATH for "${name}"`);
      try {
        let result;
        if (isWindows) {
          result = await Command.create(scopeName('cmd.exe'), ['/c', 'where', name]).execute();
        } else {
          result = await Command.create(scopeName('which'), [name]).execute();
        }
        console.log(`[AgentInstallationService] detectViaShell: tier 2 result - code=${result.code}, stdout="${result.stdout?.trim()}", stderr="${result.stderr?.trim()}"`);
        if (result.code === 0) {
          console.log(`[AgentInstallationService] detectViaShell: ${agentId} DETECTED via PATH`);
          return true;
        }
        console.log(`[AgentInstallationService] detectViaShell: tier 2 miss, falling through`);
      } catch (err) {
        console.log(`[AgentInstallationService] detectViaShell: tier 2 threw:`, err);
      }
      
      // 3. Try `where <binary>.cmd` for npm shims on Windows
      if (isWindows && name) {
        const shimName = `${name}.cmd`;
        console.log(`[AgentInstallationService] detectViaShell: tier 3 - checking npm shim: ${shimName}`);
        try {
          const result = await Command.create(scopeName('cmd.exe'), ['/c', 'where', shimName]).execute();
          console.log(`[AgentInstallationService] detectViaShell: tier 3 result - code=${result.code}, stdout="${result.stdout?.trim()}", stderr="${result.stderr?.trim()}"`);
          if (result.code === 0) {
            console.log(`[AgentInstallationService] detectViaShell: ${agentId} DETECTED via npm shim`);
            return true;
          }
          console.log(`[AgentInstallationService] detectViaShell: tier 3 miss`);
        } catch (err) {
          console.log(`[AgentInstallationService] detectViaShell: tier 3 threw:`, err);
        }
      }

      console.log(`[AgentInstallationService] detectViaShell: ${agentId} NOT DETECTED after all tiers`);
      return false;
    } catch (err) {
      console.log(`[AgentInstallationService] detectViaShell: outer catch - `, err);
      return false;
    }
  }

  async detectAgent(agentId: string): Promise<boolean> {
    const agent = getAgentById(agentId);
    if (!agent) {
      console.log(`[AgentInstallationService] detectAgent: ${agentId} NOT FOUND in registry`);
      return false;
    }

    const cached = this.statusCache.get(agentId);
    if (cached && Date.now() - cached.lastCheck < 30000) {
      console.log(`[AgentInstallationService] detectAgent: ${agentId} cache HIT (age=${Date.now() - cached.lastCheck}ms, detected=${cached.detected})`);
      return cached.detected;
    }
    console.log(`[AgentInstallationService] detectAgent: ${agentId} cache MISS, running detectViaShell`);

    const detected = await this.detectViaShell(agentId);

    console.log(`[AgentInstallationService] detectAgent: ${agentId} → ${detected}`);
    this.statusCache.set(agentId, {
      id: agentId,
      installed: detected,
      detected,
      lastCheck: Date.now(),
    });

    return detected;
  }

  async getAgentStatus(agentId: string): Promise<AgentStatus> {
    await this.detectAgent(agentId);
    const status = this.statusCache.get(agentId);
    console.log(`[AgentInstallationService] getAgentStatus: ${agentId} →`, status);
    return status || {
      id: agentId,
      installed: false,
      detected: false,
      lastCheck: Date.now(),
    };
  }

  async detectAllAgents(): Promise<Map<string, boolean>> {
    if (this.scanInProgress) {
      console.log(`[AgentInstallationService] detectAllAgents: scan already in progress, waiting...`);
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
      console.log(`[AgentInstallationService] detectAllAgents: returned cached results (${results.size} agents)`);
      return results;
    }

    this.scanInProgress = true;
    const results = new Map<string, boolean>();
    console.log(`[AgentInstallationService] detectAllAgents: scanning ${getAllAgents().length} agents...`);

    const agents = getAllAgents();
    await Promise.allSettled(
      agents.map(async (agent) => {
        const detected = await this.detectAgent(agent.id);
        results.set(agent.id, detected);
      })
    );

    this.scanInProgress = false;
    console.log(`[AgentInstallationService] detectAllAgents: scan complete. Results:`, Object.fromEntries(results));
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
        phase: 'downloading',
        progress: 10,
        message: `Downloading ${agent.name}...`,
      });

      const { Command } = await import('@tauri-apps/plugin-shell');
      const rawBin = agent.installCommand[0];
      const installBin = isWindows ? `${rawBin}.cmd` : rawBin;
      const installScope = scopeName(installBin);

      console.log(`[AgentInstallationService] installAgent: cmd="${rawBin}" → scope="${installScope}"`);

      onProgress?.({
        agentId,
        phase: 'installing',
        progress: 40,
        message: `Installing ${agent.name}...`,
      });

      const result = await Command.create(installScope, agent.installCommand.slice(1)).execute();

      console.log(`[AgentInstallationService] installAgent: result code=${result.code}, stderr="${result.stderr?.trim()}"`);

      if (result.code === 0) {
        onProgress?.({
          agentId,
          phase: 'verifying',
          progress: 80,
          message: 'Verifying installation...',
        });

        const detected = await this.detectAgent(agentId);
        console.log(`[AgentInstallationService] installAgent: verification detectAgent returned ${detected}`);

        if (detected) {
          onProgress?.({
            agentId,
            phase: 'done',
            progress: 100,
            message: `${agent.name} installed successfully`,
          });
          return true;
        }

        onProgress?.({
          agentId,
          phase: 'error',
          progress: 0,
          message: 'Installation completed but agent not found on PATH. Try restarting the app.',
        });
        return false;
      }

      onProgress?.({
        agentId,
        phase: 'error',
        progress: 0,
        message: result.stderr || `Installation failed with code ${result.code}`,
      });
      return false;
    } catch (error) {
      console.log(`[AgentInstallationService] installAgent: caught -`, error);
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
    const cmd = [...agent.launchCommand, ...(agent.launchArgs || [])];
    console.log(`[AgentInstallationService] getLaunchCommand: ${agentId} → ${cmd.join(' ')}`);
    return cmd;
  }

  clearCache(): void {
    console.log(`[AgentInstallationService] clearCache: clearing ${this.statusCache.size} entries`);
    this.statusCache.clear();
  }

  invalidateAgent(agentId: string): void {
    console.log(`[AgentInstallationService] invalidateAgent: ${agentId}`);
    this.statusCache.delete(agentId);
  }
}

export const agentInstallationService = new AgentInstallationService();
