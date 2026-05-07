/**
 * Simple Memory Storage Service
 * 
 * A simplified memory storage implementation that uses IndexedDB for
 * persistent storage instead of the complex event sourcing mechanism.
 * This provides reliable memory persistence across page refreshes.
 */

import { v4 as uuidv4 } from 'uuid';
import Dexie, { Table } from 'dexie';

// Create database instance
class MemoryDatabase extends Dexie {
  memories!: Table<SimpleMemoryState>;

  constructor() {
    super('MemoryDatabase');
    this.version(1).stores({
      memories: 'id, type, sourceSessionId, createdAt, updatedAt, title'
    });
  }
}

const memoryDb = new MemoryDatabase();

export interface SimpleMemoryState {
  id: string;
  type: 'learning' | 'mistake' | 'decision' | 'pattern';
  title: string;
  content: string;
  domain: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
  sourceSessionId?: string;
  sourceSessionName?: string;
  sourceMessageIds?: string[];
}

export class SimpleMemoryStorage {
  private static instance: SimpleMemoryStorage | null = null;

  private constructor() {}

  static getInstance(): SimpleMemoryStorage {
    if (!this.instance) {
      this.instance = new SimpleMemoryStorage();
    }
    return this.instance;
  }

  /**
   * Create a new memory
   */
  async createMemory(
    type: 'learning' | 'mistake' | 'decision' | 'pattern',
    title: string,
    content: string,
    domain: string,
    tags: string[] = [],
    metadata: Record<string, unknown> = {},
    sessionId?: string,
    sessionName?: string,
    sourceMessageIds?: string[]
  ): Promise<string> {
    const memoryId = uuidv4();
    const timestamp = new Date().toISOString();

    const memory: SimpleMemoryState = {
      id: memoryId,
      type,
      title,
      content,
      domain,
      tags,
      metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      sourceSessionId: sessionId,
      sourceSessionName: sessionName,
      sourceMessageIds
    };

    await memoryDb.memories.put(memory);
    console.log(`SimpleMemoryStorage: Created memory "${title}" with ID ${memoryId}`);
    
    return memoryId;
  }

  /**
   * Get all memories
   */
  async getAllMemories(): Promise<SimpleMemoryState[]> {
    return await memoryDb.memories.orderBy('createdAt').reverse().toArray();
  }

  /**
   * Get memories by session ID
   */
  async getMemoriesBySession(sessionId: string): Promise<SimpleMemoryState[]> {
    return await memoryDb.memories.where('sourceSessionId').equals(sessionId).toArray();
  }

  /**
   * Get memory by ID
   */
  async getMemoryById(memoryId: string): Promise<SimpleMemoryState | null> {
    return await memoryDb.memories.get(memoryId) || null;
  }

  /**
   * Update an existing memory
   */
  async updateMemory(
    memoryId: string,
    updates: Partial<{
      title: string;
      content: string;
      domain: string;
      tags: string[];
      metadata: Record<string, unknown>;
    }>
  ): Promise<void> {
    const existing = await memoryDb.memories.get(memoryId);
    if (!existing) {
      throw new Error(`Memory not found: ${memoryId}`);
    }

    const updated: SimpleMemoryState = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1
    };

    await memoryDb.memories.put(updated);
  }

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId: string): Promise<void> {
    const existing = await memoryDb.memories.get(memoryId);
    if (!existing) {
      throw new Error(`Memory not found: ${memoryId}`);
    }
    await memoryDb.memories.delete(memoryId);
  }

  /**
   * Clear all memories (for testing)
   */
  async clearAllMemories(): Promise<void> {
    await memoryDb.memories.clear();
  }

  /**
   * Search memories by content
   */
  async searchMemories(query: string): Promise<SimpleMemoryState[]> {
    const lowerQuery = query.toLowerCase();
    const allMemories = await this.getAllMemories();
    return allMemories.filter(memory =>
      memory.title.toLowerCase().includes(lowerQuery) ||
      memory.content.toLowerCase().includes(lowerQuery) ||
      memory.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get memories by type
   */
  async getMemoriesByType(type: 'learning' | 'mistake' | 'decision' | 'pattern'): Promise<SimpleMemoryState[]> {
    const allMemories = await this.getAllMemories();
    return allMemories.filter(memory => memory.type === type);
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byDomain: Record<string, number>;
  }> {
    const memories = await this.getAllMemories();
    const byType: Record<string, number> = {};
    const byDomain: Record<string, number> = {};

    memories.forEach(memory => {
      byType[memory.type] = (byType[memory.type] || 0) + 1;
      byDomain[memory.domain] = (byDomain[memory.domain] || 0) + 1;
    });

    return {
      total: memories.length,
      byType,
      byDomain
    };
  }
}

// Singleton instance for easy access
let simpleMemoryStorageInstance: SimpleMemoryStorage | null = null;

export function getSimpleMemoryStorage(): SimpleMemoryStorage {
  if (!simpleMemoryStorageInstance) {
    simpleMemoryStorageInstance = SimpleMemoryStorage.getInstance();
  }
  return simpleMemoryStorageInstance;
}
