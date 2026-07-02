import { invoke } from '@tauri-apps/api/core';
import type { SessionFileMap } from './types';

interface DatabaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class SessionFileMapper {
  private dbPath: string = '';
  private cachedMap: SessionFileMap | null = null;

  setDbPath(path: string) {
    this.dbPath = path;
    this.cachedMap = null;
  }

  async buildSessionFileMap(projectSessions: Array<{ session_id: string; display_id: string; name: string }>): Promise<SessionFileMap> {
    if (this.cachedMap) return this.cachedMap;
    if (!this.dbPath) return {};

    const fileMap: SessionFileMap = {};

    for (const session of projectSessions) {
      const events = await this.getSessionEvents(session.session_id);
      for (const event of events) {
        const files = this.extractFilesFromEvent(event);
        for (const fileInfo of files) {
          const { file, change } = fileInfo;
          if (!file) continue;

          if (!fileMap[file]) {
            fileMap[file] = {
              sessionIds: [],
              accessCount: 0,
              lastAccessed: '',
              changes: [],
            };
          }

          const info = fileMap[file];
          if (!info.sessionIds.includes(session.session_id)) {
            info.sessionIds.push(session.session_id);
          }
          info.accessCount++;
          if (change && !info.changes.includes(change)) {
            info.changes.push(change);
          }
          const timestamp = event.created_at || event.timestamp || '';
          if (timestamp > info.lastAccessed) {
            info.lastAccessed = timestamp;
          }
        }
      }
    }

    this.cachedMap = fileMap;
    return fileMap;
  }

  private async getSessionEvents(sessionId: string): Promise<any[]> {
    try {
      const response = await invoke<DatabaseResponse<any[]>>('sqlite_execute_query', {
        dbPath: this.dbPath,
        query: `SELECT * FROM events WHERE session_id = '${sessionId}' AND event_type = 'dev_event' ORDER BY created_at DESC LIMIT 500`,
      });

      if (response.success && response.data) {
        return response.data;
      }
    } catch {
    }
    return [];
  }

  private extractFilesFromEvent(event: any): Array<{ file: string; change: string }> {
    try {
      const content = typeof event.content === 'string'
        ? JSON.parse(event.content)
        : event.content;

      if (content?.data?.files && Array.isArray(content.data.files)) {
        return content.data.files.map((f: any) => ({
          file: f.file || f.path || '',
          change: f.change || f.status || 'modified',
        }));
      }
    } catch {
    }
    return [];
  }

  getSessionDisplayIdsForFile(fileMap: SessionFileMap, filePath: string, sessions: Array<{ session_id: string; display_id: string }>): string[] {
    const info = fileMap[filePath];
    if (!info) return [];

    return info.sessionIds.map(sid => {
      const session = sessions.find(s => s.session_id === sid);
      return session?.display_id || sid.slice(0, 8);
    });
  }

  clearCache() {
    this.cachedMap = null;
  }
}

export const sessionFileMapper = new SessionFileMapper();
