/**
 * TAQWIN Memory Loader Bridge
 * Bridges TAQWIN file-based memory system to unified database
 */

import { getUnifiedMemoryAPI } from '../../memory/shared/UnifiedMemoryAPI';
import { UnifiedMemory } from '../../memory/shared/UnifiedMemoryDatabase';

interface CreateMemoryRequest {
  session_id: string;
  title: string;
  content: string;
  type: 'learning' | 'mistake' | 'decision' | 'pattern' | 'fact' | 'preference' | 'event';
  domain: string;
  tags: string[];
  importance: number;
  confidence: number;
  metadata: Record<string, any>;
  system_origin: 'taqwin' | 'knez' | 'unified';
}

export interface TaqwinMemoryData {
  summary: string;
  mistakes: TaqwinMistake[];
  tickets: TaqwinTicket[];
  log: TaqwinLogEntry[];
  loaded_at: string;
}

export interface TaqwinMistake {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  resolved_at?: string;
  lessons_learned?: string;
  tags: string[];
}

export interface TaqwinTicket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  tags: string[];
}

export interface TaqwinLogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  context?: Record<string, any>;
  tags: string[];
}

export class MemoryLoaderBridge {
  private api = getUnifiedMemoryAPI();
  private taqwinPath: string;

  constructor(taqwinPath: string = '.taqwin') {
    this.taqwinPath = taqwinPath;
  }

  /**
   * Load TAQWIN memory data from file system
   */
  async loadTaqwinMemory(): Promise<TaqwinMemoryData> {
    try {
      const memory: TaqwinMemoryData = {
        summary: await this._loadMemorySummary(),
        mistakes: await this._loadMistakes(),
        tickets: await this._loadTickets(),
        log: await this._loadLog(),
        loaded_at: new Date().toISOString()
      };

      await this._validateMemory(memory);
      return memory;
    } catch (error) {
      throw new Error(`Failed to load TAQWIN memory: ${error}`);
    }
  }

  /**
   * Migrate TAQWIN memory to unified database
   */
  async migrateToUnifiedDatabase(memoryData: TaqwinMemoryData): Promise<{
    memories: string[];
    relations: string[];
    errors: string[];
  }> {
    const results = {
      memories: [] as string[],
      relations: [] as string[],
      errors: [] as string[]
    };

    try {
      // Migrate memory summary
      if (memoryData.summary) {
        const summaryMemory = await this._createMemoryFromSummary(memoryData.summary);
        results.memories.push(summaryMemory.id);
      }

      // Migrate mistakes
      for (const mistake of memoryData.mistakes) {
        try {
          const mistakeMemory = await this._createMemoryFromMistake(mistake);
          results.memories.push(mistakeMemory.id);
        } catch (error) {
          results.errors.push(`Failed to migrate mistake ${mistake.id}: ${error}`);
        }
      }

      // Migrate tickets
      for (const ticket of memoryData.tickets) {
        try {
          const ticketMemory = await this._createMemoryFromTicket(ticket);
          results.memories.push(ticketMemory.id);
        } catch (error) {
          results.errors.push(`Failed to migrate ticket ${ticket.id}: ${error}`);
        }
      }

      // Migrate log entries (only warnings and errors)
      for (const logEntry of memoryData.log.filter(entry => 
        entry.level === 'warning' || entry.level === 'error'
      )) {
        try {
          const logMemory = await this._createMemoryFromLogEntry(logEntry);
          results.memories.push(logMemory.id);
        } catch (error) {
          results.errors.push(`Failed to migrate log entry ${logEntry.id}: ${error}`);
        }
      }

      // Create relations between related memories
      await this._createMemoryRelations(results.memories, memoryData);

      return results;
    } catch (error) {
      throw new Error(`Migration failed: ${error}`);
    }
  }

  /**
   * Sync changes from TAQWIN to unified database
   */
  async syncChanges(): Promise<{
    added: number;
    updated: number;
    errors: string[];
  }> {
    const results = {
      added: 0,
      updated: 0,
      errors: [] as string[]
    };

    try {
      const currentMemory = await this.loadTaqwinMemory();
      const existingMemories = await this.api.getMemories({});

      // Find new and updated items
      const existingTaqwinIds = new Set(
        existingMemories
          .filter(m => m.metadata?.taqwin_id)
          .map(m => m.metadata?.taqwin_id)
      );

      // Process mistakes
      for (const mistake of currentMemory.mistakes) {
        if (!existingTaqwinIds.has(mistake.id)) {
          await this._createMemoryFromMistake(mistake);
          results.added++;
        } else {
          // Update existing memory
          await this._updateMemoryFromMistake(mistake);
          results.updated++;
        }
      }

      // Process tickets
      for (const ticket of currentMemory.tickets) {
        if (!existingTaqwinIds.has(ticket.id)) {
          await this._createMemoryFromTicket(ticket);
          results.added++;
        } else {
          await this._updateMemoryFromTicket(ticket);
          results.updated++;
        }
      }

      return results;
    } catch (error) {
      results.errors.push(`Sync failed: ${error}`);
      return results;
    }
  }

  private async _loadMemorySummary(): Promise<string> {
    // Implementation would read from .taqwin/present/memory_summary.md
    // For now, return a placeholder
    return "TAQWIN System Memory Summary - Current operational state and key insights";
  }

  private async _loadMistakes(): Promise<TaqwinMistake[]> {
    // Implementation would read from .taqwin/memory/development/mistakes.md
    // For now, return placeholder data
    return [
      {
        id: "mistake_001",
        title: "Initial Memory Architecture Design",
        description: "Overly complex initial design that needed simplification",
        category: "architecture",
        severity: "medium",
        created_at: "2024-01-15T10:00:00Z",
        lessons_learned: "Start simple, iterate complexity",
        tags: ["architecture", "design", "lesson"]
      }
    ];
  }

  private async _loadTickets(): Promise<TaqwinTicket[]> {
    // Implementation would read from .taqwin/tickets/*.md
    // For now, return placeholder data
    return [
      {
        id: "ticket_001",
        title: "Implement Memory GUI",
        description: "Create comprehensive memory management interface",
        status: "completed",
        priority: "high",
        created_at: "2024-01-10T09:00:00Z",
        updated_at: "2024-01-20T15:30:00Z",
        tags: ["gui", "memory", "interface"]
      }
    ];
  }

  private async _loadLog(): Promise<TaqwinLogEntry[]> {
    // Implementation would read from .taqwin/memory/log.md
    // For now, return placeholder data
    return [
      {
        id: "log_001",
        timestamp: "2024-01-20T15:30:00Z",
        level: "info",
        message: "Memory GUI implementation completed",
        tags: ["milestone", "gui"]
      }
    ];
  }

  private async _validateMemory(memory: TaqwinMemoryData): Promise<void> {
    if (!memory.summary) {
      throw new Error("Memory summary is required");
    }
    if (!memory.mistakes || !Array.isArray(memory.mistakes)) {
      throw new Error("Valid mistakes array is required");
    }
    if (!memory.tickets || !Array.isArray(memory.tickets)) {
      throw new Error("Valid tickets array is required");
    }
    if (!memory.log || !Array.isArray(memory.log)) {
      throw new Error("Valid log array is required");
    }
  }

  private async _createMemoryFromSummary(summary: string): Promise<UnifiedMemory> {
    const request: CreateMemoryRequest = {
      session_id: 'taqwin_migration',
      title: 'TAQWIN Memory Summary',
      content: summary,
      type: 'fact',
      domain: 'taqwin',
      tags: ['summary', 'taqwin', 'system'],
      importance: 8,
      confidence: 1.0,
      metadata: {
        source: 'taqwin_memory_summary',
        taqwin_id: 'summary_main',
        migrated_at: new Date().toISOString()
      },
      system_origin: 'taqwin'
    };

    return await this.api.createMemory(request);
  }

  private async _createMemoryFromMistake(mistake: TaqwinMistake): Promise<UnifiedMemory> {
    const content = `**Mistake**: ${mistake.title}\n\n**Description**: ${mistake.description}\n\n**Lessons Learned**: ${mistake.lessons_learned || 'Not documented'}`;
    
    const request: CreateMemoryRequest = {
      session_id: 'taqwin_migration',
      title: mistake.title,
      content: content,
      type: 'mistake',
      domain: mistake.category,
      tags: [...mistake.tags, 'taqwin', 'mistake'],
      importance: this._severityToImportance(mistake.severity),
      confidence: 1.0,
      metadata: {
        source: 'taqwin_mistakes',
        taqwin_id: mistake.id,
        severity: mistake.severity,
        category: mistake.category,
        created_at: mistake.created_at,
        resolved_at: mistake.resolved_at,
        migrated_at: new Date().toISOString()
      },
      system_origin: 'taqwin'
    };

    return await this.api.createMemory(request);
  }

  private async _createMemoryFromTicket(ticket: TaqwinTicket): Promise<UnifiedMemory> {
    const content = `**Ticket**: ${ticket.title}\n\n**Description**: ${ticket.description}\n\n**Status**: ${ticket.status}\n**Priority**: ${ticket.priority}`;
    
    const request: CreateMemoryRequest = {
      session_id: 'taqwin_migration',
      title: ticket.title,
      content: content,
      type: 'event',
      domain: 'tasks',
      tags: [...ticket.tags, 'taqwin', 'ticket'],
      importance: this._priorityToImportance(ticket.priority),
      confidence: 1.0,
      metadata: {
        source: 'taqwin_tickets',
        taqwin_id: ticket.id,
        status: ticket.status,
        priority: ticket.priority,
        assigned_to: ticket.assigned_to,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        migrated_at: new Date().toISOString()
      },
      system_origin: 'taqwin'
    };

    return await this.api.createMemory(request);
  }

  private async _createMemoryFromLogEntry(logEntry: TaqwinLogEntry): Promise<UnifiedMemory> {
    const content = `**Log Entry**: ${logEntry.message}\n\n**Level**: ${logEntry.level}\n**Timestamp**: ${logEntry.timestamp}`;
    
    const request: CreateMemoryRequest = {
      session_id: 'taqwin_migration',
      title: `Log Entry - ${logEntry.level.toUpperCase()}`,
      content: content,
      type: 'event',
      domain: 'system',
      tags: [...logEntry.tags, 'taqwin', 'log', logEntry.level],
      importance: logEntry.level === 'error' ? 8 : logEntry.level === 'warning' ? 6 : 3,
      confidence: 1.0,
      metadata: {
        source: 'taqwin_log',
        taqwin_id: logEntry.id,
        level: logEntry.level,
        timestamp: logEntry.timestamp,
        context: logEntry.context,
        migrated_at: new Date().toISOString()
      },
      system_origin: 'taqwin'
    };

    return await this.api.createMemory(request);
  }

  private async _updateMemoryFromMistake(mistake: TaqwinMistake): Promise<void> {
    // Implementation would find existing memory by taqwin_id and update it
    // For now, this is a placeholder
  }

  private async _updateMemoryFromTicket(ticket: TaqwinTicket): Promise<void> {
    // Implementation would find existing memory by taqwin_id and update it
    // For now, this is a placeholder
  }

  private async _createMemoryRelations(memoryIds: string[], memoryData: TaqwinMemoryData): Promise<void> {
    // Implementation would create relations between related memories
    // For now, this is a placeholder
  }

  private _severityToImportance(severity: string): number {
    switch (severity) {
      case 'critical': return 10;
      case 'high': return 8;
      case 'medium': return 6;
      case 'low': return 4;
      default: return 5;
    }
  }

  private _priorityToImportance(priority: string): number {
    switch (priority) {
      case 'urgent': return 10;
      case 'high': return 8;
      case 'medium': return 6;
      case 'low': return 4;
      default: return 5;
    }
  }
}

export default MemoryLoaderBridge;
