/**
 * Memory Injection Test
 * 
 * Automated test to validate memory loader and injection system
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getMemoryLoaderService } from './memory/MemoryLoaderService';
import { getMemoryEventSourcingService } from './memory/storage/MemoryEventSourcingService';
import * as fs from 'fs';
import * as path from 'path';

describe('Memory Injection System', () => {
  const memoryLoader = getMemoryLoaderService();
  const memoryService = getMemoryEventSourcingService();
  const testFilePath = path.join(process.cwd(), 'src/memory/inject/test-memory.md');

  beforeAll(async () => {
    // Ensure test file exists
    if (!fs.existsSync(testFilePath)) {
      throw new Error('Test memory file does not exist');
    }

    // Start the memory loader
    memoryLoader.startWatching();

    // Wait for initial file processing
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(() => {
    // Stop the memory loader
    memoryLoader.stopWatching();
  });

  it('should start watching the directory', () => {
    const status = memoryLoader.getStatus();
    expect(status.watching).toBe(true);
    expect(status.watchPath).toBe('src/memory/inject');
  });

  it('should inject memories from files', async () => {
    const status = memoryLoader.getStatus();
    expect(status.injectedCount).toBeGreaterThan(0);
  });

  it('should have knez-control-app memories in the system', () => {
    const allMemories = memoryService.getAllMemories();
    
    // Check for knez-control-app related memories
    const knezMemories = allMemories.filter(m => 
      m.domain === 'knez-control-app' || 
      m.title.toLowerCase().includes('knez') ||
      m.content.toLowerCase().includes('knez')
    );

    expect(knezMemories.length).toBeGreaterThan(0);
  });

  it('should have test memory in the system', () => {
    const allMemories = memoryService.getAllMemories();
    
    const testMemories = allMemories.filter(m => 
      m.domain === 'test' || 
      m.title.toLowerCase().includes('test') ||
      m.content.toLowerCase().includes('test memory')
    );

    expect(testMemories.length).toBeGreaterThan(0);
  });

  it('should be able to search for knez-control-app memories', () => {
    const results = memoryService.searchMemories('knez-control-app');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should be able to search for tauri memories', () => {
    const results = memoryService.searchMemories('tauri');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should be able to search for test memory', () => {
    const results = memoryService.searchMemories('test memory');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should have memories with correct structure', () => {
    const allMemories = memoryService.getAllMemories();
    
    for (const memory of allMemories) {
      expect(memory).toHaveProperty('id');
      expect(memory).toHaveProperty('type');
      expect(memory).toHaveProperty('title');
      expect(memory).toHaveProperty('content');
      expect(memory).toHaveProperty('domain');
      expect(memory).toHaveProperty('tags');
      expect(memory).toHaveProperty('metadata');
      expect(memory).toHaveProperty('createdAt');
      expect(memory).toHaveProperty('updatedAt');
      expect(memory).toHaveProperty('version');
    }
  });

  it('should have knez-control-app memories with expected content', () => {
    const knezMemories = memoryService.searchMemories('tauri');
    
    expect(knezMemories.length).toBeGreaterThan(0);
    
    const hasTauriInfo = knezMemories.some(m => 
      m.content.toLowerCase().includes('tauri')
    );
    
    expect(hasTauriInfo).toBe(true);
  });

  it('should have no errors in loader', () => {
    const status = memoryLoader.getStatus();
    expect(status.errors.length).toBe(0);
  });
});
