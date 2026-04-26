/**
 * Static Memory Loader
 * 
 * Browser-compatible memory loader that uses fetch API to load markdown files
 * from the public directory and inject them into the event-sourced memory system.
 * 
 * Supported formats: .md (default), .json, .txt
 */

import { getMemoryEventSourcingService } from './storage/MemoryEventSourcingService';

export interface MemoryData {
  type: 'learning' | 'mistake' | 'decision' | 'pattern';
  title: string;
  content: string;
  domain: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface LoaderStatus {
  loaded: boolean;
  loadedCount: number;
  lastLoad: string | null;
  errors: string[];
}

export class StaticMemoryLoader {
  private memoryService = getMemoryEventSourcingService();
  private loadedCount: number = 0;
  private lastLoad: string | null = null;
  private errors: string[] = [];
  private loadedHashes: Set<string> = new Set(); // Track loaded content hashes for deduplication

  /**
   * Load all memory files from the public/memory directory
   */
  async loadMemories(): Promise<LoaderStatus> {
    this.loadedCount = 0;
    this.errors = [];
    this.lastLoad = new Date().toISOString();

    try {
      // List of known memory files to load
      const memoryFiles = [
        'knez-control-app.md',
        'test-memory.md'
      ];

      for (const filename of memoryFiles) {
        try {
          await this.loadMemoryFile(filename);
        } catch (error) {
          const errorMsg = `Failed to load ${filename}: ${error}`;
          this.errors.push(errorMsg);
          console.error(`[StaticMemoryLoader] ${errorMsg}`);
        }
      }

      this.loaded = true;
    } catch (error) {
      const errorMsg = `Failed to load memories: ${error}`;
      this.errors.push(errorMsg);
      console.error(`[StaticMemoryLoader] ${errorMsg}`);
    }

    return {
      loaded: this.loaded,
      loadedCount: this.loadedCount,
      lastLoad: this.lastLoad,
      errors: this.errors
    };
  }

  /**
   * Load a single memory file
   */
  private async loadMemoryFile(filename: string): Promise<void> {
    const url = `/memory/${filename}`;
    
    try {
      console.log(`[StaticMemoryLoader] Fetching ${url}...`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      console.log(`[StaticMemoryLoader] Fetched ${content.length} bytes from ${filename}`);
      const ext = filename.split('.').pop()?.toLowerCase();

      let memoryData: MemoryData | MemoryData[];

      if (ext === 'json') {
        memoryData = JSON.parse(content);
      } else if (ext === 'md') {
        memoryData = this.parseMarkdown(content);
        console.log(`[StaticMemoryLoader] Parsed ${memoryData.length} memories from ${filename}`);
      } else if (ext === 'txt') {
        memoryData = this.parsePlainText(content);
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      // Inject memories with deduplication
      const memories = Array.isArray(memoryData) ? memoryData : [memoryData];
      for (const mem of memories) {
        // Create hash from content for deduplication
        const contentHash = this.simpleHash(mem.content);
        
        // Skip if already loaded
        if (this.loadedHashes.has(contentHash)) {
          console.log(`[StaticMemoryLoader] Skipping duplicate memory: ${mem.title}`);
          continue;
        }
        
        console.log(`[StaticMemoryLoader] Injecting memory: ${mem.title}`);
        await this.memoryService.createMemory(
          mem.type,
          mem.title,
          mem.content,
          mem.domain,
          mem.tags,
          mem.metadata
        );
        this.loadedHashes.add(contentHash);
        this.loadedCount++;
      }

      console.log(`[StaticMemoryLoader] Loaded ${memories.length} memory(ies) from ${filename}`);
    } catch (error) {
      console.error(`[StaticMemoryLoader] Error loading ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Simple hash function for content deduplication
   */
  private simpleHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Parse markdown file into memory data
   */
  private parseMarkdown(content: string): MemoryData[] {
    const memories: MemoryData[] = [];
    const sections = content.split(/^---$/gm);
    console.log(`[StaticMemoryLoader] Split content into ${sections.length} sections`);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      const lines = trimmed.split('\n');
      let title = '';
      let type: 'learning' | 'mistake' | 'decision' | 'pattern' = 'learning';
      let domain = 'default';
      let tags: string[] = [];
      let contentLines: string[] = [];

      let inContent = false;

      for (const line of lines) {
        if (line.startsWith('# ') && !inContent) {
          title = line.substring(2);
        } else if (line.toLowerCase().startsWith('domain:')) {
          domain = line.split(':', 2)[1]?.trim() || 'default';
        } else if (line.toLowerCase().startsWith('tags:')) {
          tags = line.split(':', 2)[1]?.trim().split(',').map(t => t.trim()) || [];
        } else if (line.toLowerCase().startsWith('type:')) {
          const typeValue = line.split(':', 2)[1]?.trim().toLowerCase();
          if (['learning', 'mistake', 'decision', 'pattern'].includes(typeValue)) {
            type = typeValue as 'learning' | 'mistake' | 'decision' | 'pattern';
          }
        } else if (line.startsWith('#') || line.trim() === '') {
          inContent = true;
        } else if (inContent) {
          contentLines.push(line);
        }
      }

      if (title && contentLines.length > 0) {
        memories.push({
          type,
          title,
          content: contentLines.join('\n'),
          domain,
          tags
        });
        console.log(`[StaticMemoryLoader] Parsed memory: ${title} (${contentLines.length} lines)`);
      }
    }

    console.log(`[StaticMemoryLoader] Total memories parsed: ${memories.length}`);
    return memories;
  }

  /**
   * Parse plain text file into memory data
   */
  private parsePlainText(content: string): MemoryData {
    const lines = content.split('\n');
    const title = lines[0] || 'Untitled Memory';
    const textContent = lines.slice(1).join('\n');

    return {
      type: 'learning',
      title,
      content: textContent,
      domain: 'default',
      tags: []
    };
  }

  /**
   * Get current loader status
   */
  getStatus(): LoaderStatus {
    return {
      loaded: this.loaded,
      loadedCount: this.loadedCount,
      lastLoad: this.lastLoad,
      errors: this.errors
    };
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  private loaded: boolean = false;
}

// Singleton instance
let staticMemoryLoader: StaticMemoryLoader | null = null;

export function getStaticMemoryLoader(): StaticMemoryLoader {
  if (!staticMemoryLoader) {
    staticMemoryLoader = new StaticMemoryLoader();
  }
  return staticMemoryLoader;
}

export function resetStaticMemoryLoader(): void {
  staticMemoryLoader = null;
}
