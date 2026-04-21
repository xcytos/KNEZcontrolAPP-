/**
 * Memory Loader Service
 * 
 * Continuous file watcher service that monitors a directory for memory files
 * and automatically injects them into the event-sourced memory system.
 * 
 * Supported formats: .md (default), .json, .txt
 * 
 * Note: This service uses Node.js fs module and only works in Node.js environment.
 * It is NOT compatible with browser/Tauri environment.
 */

import * as fs from 'fs';
import * as path from 'path';
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
  watching: boolean;
  watchPath: string;
  injectedCount: number;
  lastInjection: string | null;
  errors: string[];
}

export class MemoryLoaderService {
  private watchPath: string;
  private watcher: fs.FSWatcher | null = null;
  private memoryService = getMemoryEventSourcingService();
  private injectedCount: number = 0;
  private lastInjection: string | null = null;
  private errors: string[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly debounceMs = 500;

  constructor(watchPath: string = 'src/memory/inject') {
    this.watchPath = watchPath;
    this.ensureDirectoryExists();
  }

  /**
   * Ensure the watch directory exists
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.watchPath)) {
      fs.mkdirSync(this.watchPath, { recursive: true });
      console.log(`[MemoryLoader] Created watch directory: ${this.watchPath}`);
    }
  }

  /**
   * Start watching the directory for file changes
   */
  startWatching(): void {
    if (this.watcher) {
      console.log('[MemoryLoader] Already watching');
      return;
    }

    try {
      this.watcher = fs.watch(this.watchPath, (_eventType, filename) => {
        if (!filename) return;

        const filePath = path.join(this.watchPath, filename);
        const ext = path.extname(filename).toLowerCase();

        // Only process supported file types
        if (['.md', '.json', '.txt'].includes(ext)) {
          // Debounce file changes to avoid duplicate processing
          const existingTimer = this.debounceTimers.get(filePath);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          const timer = setTimeout(() => {
            this.handleFileChange(filePath, filename);
            this.debounceTimers.delete(filePath);
          }, this.debounceMs);

          this.debounceTimers.set(filePath, timer);
        }
      });

      console.log(`[MemoryLoader] Started watching: ${this.watchPath}`);
      
      // Process existing files on startup
      this.processExistingFiles();
    } catch (error) {
      const errorMsg = `Failed to start watching: ${error}`;
      this.errors.push(errorMsg);
      console.error(`[MemoryLoader] ${errorMsg}`);
    }
  }

  /**
   * Stop watching the directory
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('[MemoryLoader] Stopped watching');
    }

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Process existing files in the directory
   */
  private async processExistingFiles(): Promise<void> {
    try {
      const files = fs.readdirSync(this.watchPath);
      
      for (const file of files) {
        const filePath = path.join(this.watchPath, file);
        const ext = path.extname(file).toLowerCase();
        
        if (['.md', '.json', '.txt'].includes(ext)) {
          await this.injectFromFile(filePath);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to process existing files: ${error}`;
      this.errors.push(errorMsg);
      console.error(`[MemoryLoader] ${errorMsg}`);
    }
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(filePath: string, filename: string): Promise<void> {
    console.log(`[MemoryLoader] File changed: ${filename}`);
    await this.injectFromFile(filePath);
  }

  /**
   * Inject memory from a file
   */
  async injectFromFile(filePath: string): Promise<void> {
    try {
      const ext = path.extname(filePath).toLowerCase();
      let memoryData: MemoryData;

      switch (ext) {
        case '.md':
          memoryData = this.parseMarkdownFile(filePath);
          break;
        case '.json':
          memoryData = this.parseJsonFile(filePath);
          break;
        case '.txt':
          memoryData = this.parseTextFile(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${ext}`);
      }

      await this.injectMemory(memoryData);
      console.log(`[MemoryLoader] Injected memory from: ${path.basename(filePath)}`);
    } catch (error) {
      const errorMsg = `Failed to inject from ${filePath}: ${error}`;
      this.errors.push(errorMsg);
      console.error(`[MemoryLoader] ${errorMsg}`);
    }
  }

  /**
   * Parse a markdown file
   */
  private parseMarkdownFile(filePath: string): MemoryData {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');

    let title = '';
    let domain = 'general';
    let tags: string[] = [];
    let type: 'learning' | 'mistake' | 'decision' | 'pattern' = 'learning';
    let bodyLines: string[] = [];
    let inFrontmatter = false;

    for (const line of lines) {
      // Check for frontmatter
      if (line.trim() === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        } else {
          inFrontmatter = false;
          continue;
        }
      }

      if (inFrontmatter) {
        continue;
      }

      // Extract title from first heading
      if (!title && line.startsWith('#')) {
        title = line.replace(/^#+\s*/, '').trim();
        continue;
      }

      // Extract metadata
      const domainMatch = line.match(/^domain:\s*(.+)/i);
      if (domainMatch) {
        domain = domainMatch[1].trim();
        continue;
      }

      const tagsMatch = line.match(/^tags:\s*(.+)/i);
      if (tagsMatch) {
        tags = tagsMatch[1].split(',').map(t => t.trim());
        continue;
      }

      const typeMatch = line.match(/^type:\s*(.+)/i);
      if (typeMatch) {
        const typeValue = typeMatch[1].trim().toLowerCase();
        if (['learning', 'mistake', 'decision', 'pattern'].includes(typeValue)) {
          type = typeValue as any;
        }
        continue;
      }

      // Add to body
      if (line.trim() || bodyLines.length > 0) {
        bodyLines.push(line);
      }
    }

    // If no title found, use filename
    if (!title) {
      title = path.basename(filePath, path.extname(filePath));
    }

    // Join body lines
    const content = bodyLines.join('\n').trim();

    return {
      type,
      title,
      content,
      domain,
      tags,
      metadata: { source: filePath }
    };
  }

  /**
   * Parse a JSON file
   */
  private parseJsonFile(filePath: string): MemoryData {
    const jsonContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(jsonContent);

    return {
      type: data.type || 'learning',
      title: data.title,
      content: data.content,
      domain: data.domain || 'general',
      tags: data.tags || [],
      metadata: { ...data.metadata, source: filePath }
    };
  }

  /**
   * Parse a text file
   */
  private parseTextFile(filePath: string): MemoryData {
    const textContent = fs.readFileSync(filePath, 'utf-8');
    const lines = textContent.split('\n');

    const title = lines[0] || path.basename(filePath, path.extname(filePath));
    const body = lines.slice(1).join('\n').trim();

    return {
      type: 'learning',
      title,
      content: body,
      domain: 'general',
      tags: [],
      metadata: { source: filePath }
    };
  }

  /**
   * Inject memory data into the event-sourced memory system
   */
  async injectMemory(data: MemoryData): Promise<string> {
    try {
      const memoryId = await this.memoryService.createMemory(
        data.type,
        data.title,
        data.content,
        data.domain,
        data.tags,
        data.metadata
      );

      this.injectedCount++;
      this.lastInjection = new Date().toISOString();
      
      return memoryId;
    } catch (error) {
      throw new Error(`Failed to inject memory: ${error}`);
    }
  }

  /**
   * Get loader status
   */
  getStatus(): LoaderStatus {
    return {
      watching: this.watcher !== null,
      watchPath: this.watchPath,
      injectedCount: this.injectedCount,
      lastInjection: this.lastInjection,
      errors: [...this.errors]
    };
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    this.errors = [];
  }
}

// Singleton instance
let memoryLoaderService: MemoryLoaderService | null = null;

export function getMemoryLoaderService(watchPath?: string): MemoryLoaderService {
  if (!memoryLoaderService) {
    memoryLoaderService = new MemoryLoaderService(watchPath);
  }
  return memoryLoaderService;
}

export function resetMemoryLoaderService(): void {
  if (memoryLoaderService) {
    memoryLoaderService.stopWatching();
    memoryLoaderService = null;
  }
}
