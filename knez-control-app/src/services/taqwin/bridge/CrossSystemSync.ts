/**
 * Cross-System Synchronization Service
 * Synchronizes data between TAQWIN and KNEZ systems
 */

import { getUnifiedMemoryAPI } from '../../memory/shared/UnifiedMemoryAPI';
import MemoryLoaderBridge from './MemoryLoaderBridge';
import ToolRegistryBridge from './ToolRegistryBridge';
import MonitoringBridge from './MonitoringBridge';

export interface SyncConfiguration {
  auto_sync: boolean;
  sync_interval: number; // in minutes
  sync_directions: ('taqwin_to_knez' | 'knez_to_taqwin' | 'bidirectional')[];
  conflict_resolution: 'taqwin_wins' | 'knez_wins' | 'merge' | 'manual';
  excluded_domains: string[];
}

export interface SyncResult {
  success: boolean;
  items_synced: number;
  conflicts: SyncConflict[];
  errors: string[];
  duration: number;
  timestamp: string;
}

export interface SyncConflict {
  id: string;
  type: 'memory' | 'tool' | 'session';
  taqwin_data: any;
  knez_data: any;
  conflict_reason: string;
  resolution?: 'taqwin_wins' | 'knez_wins' | 'merged' | 'manual';
}

export interface SyncMetrics {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  average_duration: number;
  last_sync: string;
  items_synced: number;
  conflicts_resolved: number;
}

export class CrossSystemSync {
  private api = getUnifiedMemoryAPI();
  private memoryBridge: MemoryLoaderBridge;
  private toolBridge: ToolRegistryBridge;
  private monitoringBridge: MonitoringBridge;
  private config: SyncConfiguration;
  private syncMetrics: SyncMetrics;
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor(config?: Partial<SyncConfiguration>) {
    this.config = {
      auto_sync: true,
      sync_interval: 15, // 15 minutes
      sync_directions: ['taqwin_to_knez'],
      conflict_resolution: 'taqwin_wins',
      excluded_domains: ['temp', 'cache'],
      ...config
    };

    this.memoryBridge = new MemoryLoaderBridge();
    this.toolBridge = new ToolRegistryBridge();
    this.monitoringBridge = new MonitoringBridge();

    this.syncMetrics = {
      total_syncs: 0,
      successful_syncs: 0,
      failed_syncs: 0,
      average_duration: 0,
      last_sync: '',
      items_synced: 0,
      conflicts_resolved: 0
    };

    if (this.config.auto_sync) {
      this.startAutoSync();
    }
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.performSync().catch(error => {
        console.error('Auto sync failed:', error);
      });
    }, this.config.sync_interval * 60 * 1000);
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Perform manual synchronization
   */
  async performSync(directions?: string[]): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      const result: SyncResult = {
        success: false,
        items_synced: 0,
        conflicts: [],
        errors: [],
        duration: 0,
        timestamp: new Date().toISOString()
      };

      const syncDirections = directions || this.config.sync_directions;

      // Sync based on configured directions
      for (const direction of syncDirections) {
        try {
          if (direction === 'taqwin_to_knez') {
            await this.syncTaqwinToKnez(result);
          } else if (direction === 'knez_to_taqwin') {
            await this.syncKnezToTaqwin(result);
          } else if (direction === 'bidirectional') {
            await this.syncTaqwinToKnez(result);
            await this.syncKnezToTaqwin(result);
          }
        } catch (error) {
          result.errors.push(`Failed to sync ${direction}: ${error}`);
        }
      }

      // Resolve conflicts
      if (result.conflicts.length > 0) {
        await this.resolveConflicts(result.conflicts);
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      // Update metrics
      this.updateSyncMetrics(result);

      // Log sync result
      await this.logSyncResult(result);

      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync TAQWIN data to KNEZ
   */
  private async syncTaqwinToKnez(result: SyncResult): Promise<void> {
    try {
      // Load TAQWIN memory data
      const taqwinMemory = await this.memoryBridge.loadTaqwinMemory();
      
      // Migrate to unified database
      const migrationResult = await this.memoryBridge.migrateToUnifiedDatabase(taqwinMemory);
      
      result.items_synced += migrationResult.memories.length;
      result.errors.push(...migrationResult.errors);

      // Sync tool registry
      const taqwinTools = this.toolBridge.getRegisteredTools();
      for (const tool of taqwinTools) {
        // Check for conflicts
        const existingTool = this.toolBridge.getTool(tool.name);
        if (existingTool && this.hasToolConflict(existingTool, tool)) {
          result.conflicts.push({
            id: `tool_${tool.name}`,
            type: 'tool',
            taqwin_data: tool,
            knez_data: existingTool,
            conflict_reason: 'Tool configuration differs between systems'
          });
        } else {
          // Register or update tool
          this.toolBridge.registerTool(tool);
          result.items_synced++;
        }
      }

      // Sync monitoring data
      const currentMetrics = this.monitoringBridge.getCurrentMetrics();
      if (currentMetrics) {
        this.monitoringBridge.recordMetrics(currentMetrics);
        result.items_synced++;
      }

    } catch (error) {
      result.errors.push(`TAQWIN to KNEZ sync failed: ${error}`);
    }
  }

  /**
   * Sync KNEZ data to TAQWIN
   */
  private async syncKnezToTaqwin(result: SyncResult): Promise<void> {
    try {
      // Get KNEZ memories that need to be synced to TAQWIN
      const knezMemories = await this.api.getMemories({
        domain: this.config.excluded_domains.map(d => `!${d}`)
      });

      for (const memory of knezMemories) {
        // Check if memory should be synced
        if (this.shouldSyncMemory(memory)) {
          // Check for conflicts
          const taqwinMemory = await this.findTaqwinMemory(memory.id);
          if (taqwinMemory && this.hasMemoryConflict(taqwinMemory, memory)) {
            result.conflicts.push({
              id: `memory_${memory.id}`,
              type: 'memory',
              taqwin_data: taqwinMemory,
              knez_data: memory,
              conflict_reason: 'Memory content differs between systems'
            });
          } else {
            // Sync memory to TAQWIN format
            await this.syncMemoryToTaqwin(memory);
            result.items_synced++;
          }
        }
      }

    } catch (error) {
      result.errors.push(`KNEZ to TAQWIN sync failed: ${error}`);
    }
  }

  /**
   * Resolve synchronization conflicts
   */
  private async resolveConflicts(conflicts: SyncConflict[]): Promise<void> {
    for (const conflict of conflicts) {
      try {
        let resolution: 'taqwin_wins' | 'knez_wins' | 'merged';

        switch (this.config.conflict_resolution) {
          case 'taqwin_wins':
            resolution = 'taqwin_wins';
            await this.applyTaqwinResolution(conflict);
            break;
          case 'knez_wins':
            resolution = 'knez_wins';
            await this.applyKnezResolution(conflict);
            break;
          case 'merge':
            resolution = 'merged';
            await this.mergeConflict(conflict);
            break;
          case 'manual':
            // For manual resolution, we'll defer to user intervention
            resolution = 'manual';
            break;
        }

        conflict.resolution = resolution;
        this.syncMetrics.conflicts_resolved++;

      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error);
      }
    }
  }

  /**
   * Get synchronization status
   */
  getSyncStatus(): {
    is_syncing: boolean;
    last_sync: string;
    next_sync: string;
    metrics: SyncMetrics;
    config: SyncConfiguration;
  } {
    const nextSync = this.config.auto_sync && this.syncTimer
      ? new Date(Date.now() + this.config.sync_interval * 60 * 1000).toISOString()
      : '';

    return {
      is_syncing: this.isSyncing,
      last_sync: this.syncMetrics.last_sync,
      next_sync: nextSync,
      metrics: this.syncMetrics,
      config: this.config
    };
  }

  /**
   * Update synchronization configuration
   */
  updateConfig(newConfig: Partial<SyncConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.auto_sync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * Get sync history
   */
  async getSyncHistory(limit: number = 50): Promise<any[]> {
    try {
      const memories = await this.api.getMemories({
        domain: 'sync',
        limit
      });
      
      return memories
        .filter(m => m.metadata?.sync_type === 'sync_result')
        .map(m => ({
          id: m.id,
          timestamp: m.created_at,
          success: m.metadata?.success || false,
          items_synced: m.metadata?.items_synced || 0,
          conflicts: m.metadata?.conflicts || 0,
          duration: m.metadata?.duration || 0
        }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Failed to get sync history:', error);
      return [];
    }
  }

  /**
   * Export synchronization data
   */
  exportSyncData(): {
    config: SyncConfiguration;
    metrics: SyncMetrics;
    history: any[];
    exported_at: string;
  } {
    return {
      config: this.config,
      metrics: this.syncMetrics,
      history: [], // Would be populated from getSyncHistory()
      exported_at: new Date().toISOString()
    };
  }

  // Helper methods
  private hasToolConflict(existing: any, incoming: any): boolean {
    return JSON.stringify(existing) !== JSON.stringify(incoming);
  }

  private hasMemoryConflict(existing: any, incoming: any): boolean {
    return existing.content !== incoming.content || 
           existing.updated_at !== incoming.updated_at;
  }

  private shouldSyncMemory(memory: any): boolean {
    return !this.config.excluded_domains.includes(memory.domain) &&
           memory.metadata?.sync_enabled !== false;
  }

  private async findTaqwinMemory(memoryId: string): Promise<any> {
    // This would search TAQWIN memory system
    // For now, return null (no conflict)
    return null;
  }

  private async syncMemoryToTaqwin(memory: any): Promise<void> {
    // This would convert and sync memory to TAQWIN format
    // Implementation depends on TAQWIN memory API
  }

  private async applyTaqwinResolution(conflict: SyncConflict): Promise<void> {
    if (conflict.type === 'tool') {
      this.toolBridge.registerTool(conflict.taqwin_data);
    } else if (conflict.type === 'memory') {
      // Update memory with TAQWIN data
      await this.api.updateMemory(conflict.id, conflict.taqwin_data);
    }
  }

  private async applyKnezResolution(conflict: SyncConflict): Promise<void> {
    if (conflict.type === 'tool') {
      this.toolBridge.registerTool(conflict.knez_data);
    } else if (conflict.type === 'memory') {
      // Update memory with KNEZ data (already exists)
    }
  }

  private async mergeConflict(conflict: SyncConflict): Promise<void> {
    // Implement intelligent merging logic
    if (conflict.type === 'memory') {
      const merged = {
        ...conflict.knez_data,
        content: `${conflict.knez_data.content}\n\n--- TAQWIN Version ---\n${conflict.taqwin_data.content}`,
        metadata: {
          ...conflict.knez_data.metadata,
          merged_from: ['taqwin', 'knez'],
          merged_at: new Date().toISOString()
        }
      };
      await this.api.updateMemory(conflict.id, merged);
    }
  }

  private updateSyncMetrics(result: SyncResult): void {
    this.syncMetrics.total_syncs++;
    if (result.success) {
      this.syncMetrics.successful_syncs++;
    } else {
      this.syncMetrics.failed_syncs++;
    }

    // Update average duration
    const totalDuration = this.syncMetrics.average_duration * (this.syncMetrics.total_syncs - 1) + result.duration;
    this.syncMetrics.average_duration = totalDuration / this.syncMetrics.total_syncs;

    this.syncMetrics.last_sync = result.timestamp;
    this.syncMetrics.items_synced += result.items_synced;
  }

  private async logSyncResult(result: SyncResult): Promise<void> {
    try {
      let content = `Synchronization Result\n\nStatus: ${result.success ? 'Success' : 'Failed'}\nItems Synced: ${result.items_synced}\nConflicts: ${result.conflicts.length}\nErrors: ${result.errors.length}\nDuration: ${result.duration}ms`;
      
      if (result.errors.length > 0) {
        content += `\n\nErrors:\n${result.errors.join('\n')}`;
      }

      await this.api.createMemory({
        session_id: 'taqwin_sync',
        title: `Sync Result - ${result.success ? 'Success' : 'Failed'}`,
        content: content,
        type: result.success ? 'event' : 'mistake',
        domain: 'sync',
        tags: ['taqwin', 'sync', result.success ? 'success' : 'failed'],
        importance: result.success ? 5 : 7,
        confidence: 1.0,
        metadata: {
          sync_type: 'sync_result',
          success: result.success,
          items_synced: result.items_synced,
          conflicts: result.conflicts.length,
          errors: result.errors.length,
          duration: result.duration,
          timestamp: result.timestamp
        },
        system_origin: 'taqwin'
      });
    } catch (error) {
      console.error('Failed to log sync result:', error);
    }
  }
}

export default CrossSystemSync;
