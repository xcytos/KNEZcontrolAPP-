import { getUnifiedMemoryAPI } from '../../memory/shared/UnifiedMemoryAPI';
import { byRecentDesc } from '../../../utils/sort';

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
  session_id?: string;
  project_id?: string;
  resolution_summary?: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface TicketFilters {
  status?: TaqwinTicket['status'] | TaqwinTicket['status'][];
  priority?: TaqwinTicket['priority'] | TaqwinTicket['priority'][];
  assigned_to?: string;
  tags?: string[];
  project_id?: string;
  session_id?: string;
  search?: string;
}

export class TicketRegistry {
  private api = getUnifiedMemoryAPI();
  private tickets: Map<string, TaqwinTicket> = new Map();
  private comments: Map<string, TicketComment[]> = new Map();
  private storageDir = '.taqwin/tickets';

  constructor() {
    this._loadFromStorage();
  }

  getAll(filters?: TicketFilters): TaqwinTicket[] {
    let results = Array.from(this.tickets.values());

    if (!filters) return results.sort(byRecentDesc('updated_at'));

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      results = results.filter(t => statuses.includes(t.status));
    }
    if (filters.priority) {
      const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
      results = results.filter(t => priorities.includes(t.priority));
    }
    if (filters.assigned_to) {
      results = results.filter(t => t.assigned_to === filters.assigned_to);
    }
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(t => filters.tags!.some(tag => t.tags.includes(tag)));
    }
    if (filters.project_id) {
      results = results.filter(t => t.project_id === filters.project_id);
    }
    if (filters.session_id) {
      results = results.filter(t => t.session_id === filters.session_id);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    }

    return results.sort(byRecentDesc('updated_at'));
  }

  getById(id: string): TaqwinTicket | undefined {
    return this.tickets.get(id);
  }

  createTicket(data: Omit<TaqwinTicket, 'id' | 'created_at' | 'updated_at'>): TaqwinTicket {
    const ticket: TaqwinTicket = {
      ...data,
      id: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.tickets.set(ticket.id, ticket);
    this._persistTicket(ticket);
    this._storeInMemory(ticket);
    return ticket;
  }

  updateTicket(id: string, updates: Partial<Omit<TaqwinTicket, 'id' | 'created_at'>>): TaqwinTicket | undefined {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;

    const updated: TaqwinTicket = {
      ...ticket,
      ...updates,
      id: ticket.id,
      created_at: ticket.created_at,
      updated_at: new Date().toISOString(),
    };

    this.tickets.set(id, updated);
    this._persistTicket(updated);
    this._updateInMemory(updated);
    return updated;
  }

  deleteTicket(id: string): boolean {
    const deleted = this.tickets.delete(id);
    if (deleted) {
      this._removeFromStorage(id);
      this._removeFromMemory(id);
    }
    return deleted;
  }

  addComment(ticketId: string, author: string, content: string): TicketComment | undefined {
    if (!this.tickets.has(ticketId)) return undefined;

    const comment: TicketComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ticket_id: ticketId,
      author,
      content,
      created_at: new Date().toISOString(),
    };

    const existing = this.comments.get(ticketId) || [];
    existing.push(comment);
    this.comments.set(ticketId, existing);

    this.updateTicket(ticketId, { updated_at: new Date().toISOString() });
    return comment;
  }

  getComments(ticketId: string): TicketComment[] {
    return this.comments.get(ticketId) || [];
  }

  search(query: string): TaqwinTicket[] {
    return this.getAll({ search: query });
  }

  getStats(): {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    recentlyUpdated: number;
  } {
    const tickets = Array.from(this.tickets.values());
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let recentlyUpdated = 0;

    const oneDayAgo = Date.now() - 86400000;
    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      if (new Date(t.updated_at).getTime() > oneDayAgo) recentlyUpdated++;
    }

    return { total: tickets.length, byStatus, byPriority, recentlyUpdated };
  }

  exportRegistry(): { tickets: TaqwinTicket[]; stats: ReturnType<TicketRegistry['getStats']>; exported_at: string } {
    return {
      tickets: this.getAll(),
      stats: this.getStats(),
      exported_at: new Date().toISOString(),
    };
  }

  importRegistry(data: { tickets: TaqwinTicket[] }): void {
    for (const ticket of data.tickets) {
      this.tickets.set(ticket.id, ticket);
    }
  }

  private async _storeInMemory(ticket: TaqwinTicket): Promise<void> {
    try {
      const content = `**Ticket**: ${ticket.title}\n\n**Description**: ${ticket.description}\n\n**Status**: ${ticket.status}\n**Priority**: ${ticket.priority}\n**Tags**: ${ticket.tags.join(', ')}`;

      await this.api.createMemory({
        session_id: ticket.session_id || 'ticket_registry',
        title: `[Ticket] ${ticket.title}`,
        content,
        type: 'event',
        domain: 'tasks',
        tags: [...ticket.tags, 'taqwin', 'ticket', ticket.status, ticket.priority, `ticket_id:${ticket.id}`],
        importance: this._priorityToImportance(ticket.priority),
        confidence: 1.0,
        metadata: {
          source: 'taqwin_ticket_registry',
          taqwin_id: ticket.id,
          status: ticket.status,
          priority: ticket.priority,
          assigned_to: ticket.assigned_to,
          project_id: ticket.project_id,
          session_id: ticket.session_id,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
          ticket_title: ticket.title,
        },
        system_origin: 'taqwin',
      });
    } catch (error) {
      console.error('Failed to store ticket in memory:', error);
    }
  }

  private async _updateInMemory(ticket: TaqwinTicket): Promise<void> {
    try {
      const existingMemories = await this.api.getMemories({
        tags: [`ticket_id:${ticket.id}`],
      });

      if (existingMemories.length > 0) {
        const content = `**Ticket**: ${ticket.title}\n\n**Description**: ${ticket.description}\n\n**Status**: ${ticket.status}\n**Priority**: ${ticket.priority}\n**Tags**: ${ticket.tags.join(', ')}`;

        await this.api.updateMemory(existingMemories[0].id, {
          title: `[Ticket] ${ticket.title}`,
          content,
          tags: [...ticket.tags, 'taqwin', 'ticket', ticket.status, ticket.priority, `ticket_id:${ticket.id}`],
          importance: this._priorityToImportance(ticket.priority),
          metadata: {
            ...existingMemories[0].metadata,
            status: ticket.status,
            priority: ticket.priority,
            updated_at: ticket.updated_at,
          },
        });
      } else {
        await this._storeInMemory(ticket);
      }
    } catch (error) {
      console.error('Failed to update ticket in memory:', error);
    }
  }

  private async _removeFromMemory(ticketId: string): Promise<void> {
    try {
      const existingMemories = await this.api.getMemories({
        tags: [`ticket_id:${ticketId}`],
      });

      for (const mem of existingMemories) {
        await this.api.deleteMemory(mem.id);
      }
    } catch (error) {
      console.error('Failed to remove ticket from memory:', error);
    }
  }

  private async _persistTicket(ticket: TaqwinTicket): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs');
        const dir = this.storageDir;
        await mkdir(dir, { recursive: true });
        await writeTextFile(`${dir}/${ticket.id}.json`, JSON.stringify(ticket, null, 2));
      }
    } catch (error) {
      console.debug('Non-Tauri environment, skipping file persistence:', error);
    }
  }

  private async _removeFromStorage(ticketId: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { remove } = await import('@tauri-apps/plugin-fs');
        await remove(`${this.storageDir}/${ticketId}.json`);
      }
    } catch (error) {
      console.debug('Non-Tauri environment, skipping file removal:', error);
    }
  }

  private async _loadFromStorage(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs');
        const entries = await readDir(this.storageDir);
        for (const entry of entries) {
          if (entry.name?.endsWith('.json')) {
            const content = await readTextFile(`${this.storageDir}/${entry.name}`);
            const ticket = JSON.parse(content) as TaqwinTicket;
            this.tickets.set(ticket.id, ticket);
          }
        }
      } else {
        this._seedDefaultTickets();
      }
    } catch {
      this._seedDefaultTickets();
    }
  }

  private _seedDefaultTickets(): void {
    const defaults: TaqwinTicket[] = [
      {
        id: 'ticket_001',
        title: 'Wire FullViewer stats from TaqwinDataService',
        description: 'Populate the stats state in FullViewer with real data from TaqwinDataService (totalProjects, totalSessions, activeCount) and session-level metrics (checkpoints, events, memories, decisions, files, documents).',
        status: 'in_progress',
        priority: 'high',
        created_at: '2026-07-02T19:12:13.408Z',
        updated_at: '2026-07-05T16:17:35.951Z',
        tags: ['fullviewer', 'dashboard', 'stats', 'gap'],
        project_id: 'knez-control-app',
        session_id: 'PA003',
      },
      {
        id: 'ticket_002',
        title: 'Implement filedetail right panel in FullViewer',
        description: 'Build a FileDetailPanel component for the `filedetail` right panel type. Shows file metadata (name, path, size, last modified) when a file is selected. Wire file selection context from RepositoryLens and ExplorerLens.',
        status: 'open',
        priority: 'high',
        created_at: '2026-07-02T19:27:14.775Z',
        updated_at: '2026-07-05T16:17:35.951Z',
        tags: ['fullviewer', 'dashboard', 'filedetail', 'panel', 'gap'],
        project_id: 'knez-control-app',
        session_id: 'PA003',
      },
      {
        id: 'ticket_003',
        title: 'Wire document loading in GraphLens',
        description: 'Replace hardcoded empty allDocs array in GraphLens with actual document loading from taqwinDataService to show document nodes in the relationship graph.',
        status: 'open',
        priority: 'high',
        created_at: '2026-07-02T19:27:14.775Z',
        updated_at: '2026-07-05T16:17:35.951Z',
        tags: ['fullviewer', 'graph', 'documents', 'lens', 'gap'],
        project_id: 'knez-control-app',
        session_id: 'PA003',
      },
      {
        id: 'ticket_004',
        title: 'Migrate FullViewer to use FullViewerContext',
        description: 'FullViewer.tsx manages state locally instead of using the existing FullViewerContext provider. Refactor to wrap content in FullViewerProvider and consume state via useFullViewer hook.',
        status: 'open',
        priority: 'medium',
        created_at: '2026-07-02T19:27:14.775Z',
        updated_at: '2026-07-05T16:17:35.951Z',
        tags: ['fullviewer', 'context', 'refactoring', 'gap'],
        project_id: 'knez-control-app',
        session_id: 'PA003',
      },
      {
        id: 'ticket_005',
        title: 'Implement SecondaryLens rendering in FullViewer',
        description: 'SecondaryLens is defined in FullViewerState/types but never used in FullViewer.tsx. Implement a split-view secondary lens overlay and the empty hooks/ directory for custom FullViewer hooks.',
        status: 'open',
        priority: 'medium',
        created_at: '2026-07-02T19:27:14.775Z',
        updated_at: '2026-07-05T16:17:35.951Z',
        tags: ['fullviewer', 'secondary-lens', 'hooks', 'gap'],
        project_id: 'knez-control-app',
        session_id: 'PA003',
      },
      {
        id: 'ticket_006',
        title: 'Create TicketRegistry and integrate with GovernancePanel',
        description: 'Build the TicketRegistry service class, export from bridge index, and wire it into the GovernancePanel tickets tab to load/display tickets from the registry instead of raw markdown filesystem reads.',
        status: 'completed',
        priority: 'high',
        created_at: '2026-07-05T16:17:35.951Z',
        updated_at: '2026-07-05T16:17:35.951Z',
        tags: ['ticket-registry', 'governance', 'bridge', 'infrastructure'],
        project_id: 'knez-control-app',
        session_id: 'PA003',
      },
    ];

    for (const ticket of defaults) {
      this.tickets.set(ticket.id, ticket);
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

export default TicketRegistry;
