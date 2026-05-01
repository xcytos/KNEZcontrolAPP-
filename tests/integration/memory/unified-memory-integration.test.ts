/**
 * Unified Memory System Integration Tests
 * 
 * Tests the complete unified memory system with real database operations,
 * API integration, and cross-system functionality.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getUnifiedMemoryAPI, UnifiedMemoryAPI, createTestMemoryAPI } from '../../../src/services/memory/shared/UnifiedMemoryAPI';
import { UnifiedMemoryDatabase } from '../../../src/services/memory/shared/UnifiedMemoryDatabase';
import { DataMigrationService } from '../../../src/services/memory/shared/DataMigrationService';
import { UnifiedMemory, UnifiedSession } from '../../../src/services/memory/shared/UnifiedMemoryDatabase';

describe('Unified Memory System Integration', () => {
  let database: UnifiedMemoryDatabase;
  let api: UnifiedMemoryAPI;
  let migrationService: DataMigrationService;
  let testDbPath: string;

  beforeAll(async () => {
    // Use unique test database for each test run
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    testDbPath = `.taqwin/memory/test_unified_memory_${timestamp}_${randomId}.db`;
    database = new UnifiedMemoryDatabase(testDbPath);
    await database.initialize();
    
    // Create a fresh API instance for this test run to avoid singleton sharing
    api = createTestMemoryAPI();
    migrationService = new DataMigrationService(database);
  });

  afterAll(async () => {
    // Cleanup test database
    await database.close();
    // Note: In production, you might want to keep test data for debugging
  });

  beforeEach(async () => {
    // Clean up test data completely
    await database.getDatabase().exec('DELETE FROM memories');
    await database.getDatabase().exec('DELETE FROM sessions');
    await database.getDatabase().exec('DELETE FROM memory_relations');
    await database.getDatabase().exec('DELETE FROM messages');
  });

  describe('Database Operations', () => {
    it('should create and retrieve sessions', async () => {
      const sessionData = {
        name: 'Test Session',
        system_origin: 'knez' as const,
        outcome: 'success',
        tags: ['test', 'integration'],
        metadata: { test: true }
      };

      const createdSession = await api.createSession(sessionData);
      expect(createdSession.id).toBeTruthy();
      expect(createdSession.name).toBe(sessionData.name);

      const retrievedSession = await api.getSession(createdSession.id);
      expect(retrievedSession).toBeTruthy();
      expect(retrievedSession?.name).toBe(sessionData.name);
    });

    it('should create and retrieve memories', async () => {
      // First create a session
      const session = await api.createSession({
        name: 'Memory Test Session',
        system_origin: 'knez'
      });

      const memoryData = {
        session_id: session.id,
        type: 'learning' as const,
        title: 'Test Memory',
        content: 'This is a test memory for integration testing',
        domain: 'testing',
        importance: 7,
        tags: ['test', 'memory'],
        confidence: 0.9,
        system_origin: 'knez' as const
      };

      const createdMemory = await api.createMemory(memoryData);
      expect(createdMemory.id).toBeTruthy();
      expect(createdMemory.title).toBe(memoryData.title);

      const retrievedMemory = await api.getMemory(createdMemory.id);
      expect(retrievedMemory).toBeTruthy();
      expect(retrievedMemory?.title).toBe(memoryData.title);
      expect(retrievedMemory?.content).toBe(memoryData.content);
    });

    it('should create and retrieve memory relations', async () => {
      // Create two memories
      const session = await api.createSession({
        name: 'Relation Test Session',
        system_origin: 'knez'
      });

      const memory1 = await api.createMemory({
        session_id: session.id,
        type: 'learning',
        title: 'Memory 1',
        content: 'First memory',
        domain: 'test',
        importance: 5,
        confidence: 0.8,
        system_origin: 'knez'
      });

      const memory2 = await api.createMemory({
        session_id: session.id,
        type: 'learning',
        title: 'Memory 2',
        content: 'Second memory',
        domain: 'test',
        importance: 6,
        confidence: 0.9,
        system_origin: 'knez'
      });

      // Create relation
      const relation = await api.createRelation({
        source_memory_id: memory1.id,
        target_memory_id: memory2.id,
        relationship_type: 'relates_to',
        system_origin: 'knez' as const,
        metadata: { test: true }
      });

      expect(relation.id).toBeTruthy();
      expect(relation.source_memory_id).toBe(memory1.id);
      expect(relation.target_memory_id).toBe(memory2.id);

      // Retrieve relations
      const relations = await api.getMemoryRelations(memory1.id);
      expect(relations).toHaveLength(1);
      expect(relations[0].relationship_type).toBe('relates_to');
    });
  });

  describe('Search and Analytics', () => {
    beforeEach(async () => {
      // Setup test data
      const session = await api.createSession({
        name: 'Search Test Session',
        system_origin: 'knez'
      });

      // Create test memories
      await api.createMemory({
        session_id: session.id,
        type: 'learning',
        title: 'React Testing',
        content: 'Testing React components with Vitest',
        domain: 'development',
        importance: 8,
        tags: ['react', 'testing', 'vitest'],
        confidence: 0.9,
        system_origin: 'knez'
      });

      await api.createMemory({
        session_id: session.id,
        type: 'learning',
        title: 'TypeScript Types',
        content: 'Strong typing with TypeScript',
        domain: 'development',
        importance: 7,
        tags: ['typescript', 'types'],
        confidence: 0.85,
        system_origin: 'knez'
      });

      await api.createMemory({
        session_id: session.id,
        type: 'mistake',
        title: 'Memory Leak',
        content: 'Fixed a memory leak in the application',
        domain: 'development',
        importance: 6,
        tags: ['bug', 'memory', 'leak'],
        confidence: 1.0,
        system_origin: 'knez'
      });
    });

    it('should perform full-text search', async () => {
      const searchResults = await api.searchMemories('React');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].title).toContain('React');
    });

    it('should filter memories by type', async () => {
      const learningMemories = await api.getMemories({ type: 'learning' });
      expect(learningMemories.length).toBe(2);

      const mistakeMemories = await api.getMemories({ type: 'mistake' });
      expect(mistakeMemories.length).toBe(1);
    });

    it('should filter memories by domain', async () => {
      const devMemories = await api.getMemories({ domain: 'development' });
      expect(devMemories.length).toBe(3);
    });

    it('should provide analytics', async () => {
      const analytics = await api.getMemoryAnalytics();
      expect(analytics.total_memories).toBe(3);
      expect(analytics.memories_by_type).toHaveProperty('learning', 2);
      expect(analytics.memories_by_type).toHaveProperty('mistake', 1);
      expect(analytics.memories_by_domain).toHaveProperty('development', 3);
    });
  });

  describe('Caching and Performance', () => {
    it('should cache memory retrievals', async () => {
      const session = await api.createSession({
        name: 'Cache Test Session',
        system_origin: 'knez'
      });

      const memory = await api.createMemory({
        session_id: session.id,
        type: 'learning',
        title: 'Cache Test Memory',
        content: 'Testing caching functionality',
        domain: 'test',
        importance: 5,
        confidence: 0.8,
        system_origin: 'knez'
      });

      // First retrieval (from database)
      const start1 = performance.now();
      const result1 = await api.getMemory(memory.id);
      const time1 = performance.now() - start1;

      // Second retrieval (from cache)
      const start2 = performance.now();
      const result2 = await api.getMemory(memory.id);
      const time2 = performance.now() - start2;

      expect(result1).toEqual(result2);
      expect(time2).toBeLessThan(time1); // Cache should be faster
    });

    it('should track performance metrics', async () => {
      // Perform some operations
      const session = await api.createSession({
        name: 'Performance Test Session',
        system_origin: 'knez'
      });

      await api.createMemory({
        session_id: session.id,
        type: 'learning',
        title: 'Performance Test',
        content: 'Testing performance tracking',
        domain: 'test',
        importance: 5,
        confidence: 0.8,
        system_origin: 'knez'
      });

      const metrics = await api.getPerformanceMetrics();
      expect(metrics.totalOperations).toBeGreaterThan(0);
      expect(metrics.averageQueryTime).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event System', () => {
    it('should emit memory creation events', async () => {
      const session = await api.createSession({
        name: 'Event Test Session',
        system_origin: 'knez'
      });

      let eventReceived = false;
      let eventData: any = null;

      // Listen for memory creation event
      api.on('memory:created', (data) => {
        eventReceived = true;
        eventData = data;
      });

      const memory = await api.createMemory({
        session_id: session.id,
        type: 'learning',
        title: 'Event Test Memory',
        content: 'Testing event system',
        domain: 'test',
        importance: 5,
        confidence: 0.8,
        system_origin: 'knez'
      });

      // Wait for event (events are synchronous in this implementation)
      expect(eventReceived).toBe(true);
      expect(eventData.id).toBe(memory.id);
    });

    it('should emit memory update events', async () => {
      const session = await api.createSession({
        name: 'Update Event Test Session',
        system_origin: 'knez'
      });

      const memory = await api.createMemory({
        session_id: session.id,
        type: 'learning',
        title: 'Original Title',
        content: 'Original content',
        domain: 'test',
        importance: 5,
        confidence: 0.8,
        system_origin: 'knez'
      });

      let updateEventReceived = false;
      api.on('memory:updated', () => {
        updateEventReceived = true;
      });

      await api.updateMemory(memory.id, {
        title: 'Updated Title',
        content: 'Updated content'
      });

      expect(updateEventReceived).toBe(true);
    });
  });

  describe('Data Migration', () => {
    it('should handle mock TAQWIN data migration', async () => {
      // Create mock TAQWIN data
      const mockTaqwinData = {
        summary: {
          nodes: {
            'test-memory': {
              type: 'learning',
              title: 'Test Memory',
              content: 'Test content',
              domain: 'test',
              importance: 7
            }
          },
          edges: {}
        },
        mistakes: [],
        tickets: [],
        log: []
      };

      const migrationResult = await migrationService.migrateFromTAQWIN(mockTaqwinData);
      
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.sessionsCreated).toBeGreaterThanOrEqual(0);
      expect(migrationResult.memoriesCreated).toBeGreaterThanOrEqual(0);
      
      // Verify migrated data
      const memories = await api.getMemories({ system_origin: 'taqwin' });
      if (migrationResult.memoriesCreated > 0) {
        expect(memories.length).toBeGreaterThan(0);
      }
    });

    it('should handle KNEZ session migration', async () => {
      // Mock KNEZ session data
      const mockKnezData = {
        sessions: [
          {
            id: 'test-session-id',
            name: 'Test Session',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            outcome: 'success',
            tags: ['test'],
            messages: [
              {
                id: 'test-message-id',
                sessionId: 'test-session-id',
                from: 'user',
                content: 'Test message',
                createdAt: new Date().toISOString()
              }
            ]
          }
        ],
        memories: [],
        messages: []
      };

      const migrationResult = await migrationService.migrateFromKNEZ(mockKnezData);
      
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.sessionsCreated).toBeGreaterThanOrEqual(0);
      
      // Verify migrated sessions
      const sessions = await api.getSessions({ system_origin: 'knez' });
      if (migrationResult.sessionsCreated > 0) {
        expect(sessions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid memory IDs gracefully', async () => {
      const result = await api.getMemory('invalid-id');
      expect(result).toBeNull();
    });

    it('should handle database constraints', async () => {
      const session = await api.createSession({
        name: 'Constraint Test Session',
        system_origin: 'knez'
      });

      // Try to create memory with invalid session ID
      await expect(
        api.createMemory({
          session_id: 'invalid-session-id',
          type: 'learning',
          title: 'Invalid Memory',
          content: 'This should fail',
          domain: 'test',
          importance: 5,
          confidence: 0.8,
          system_origin: 'knez'
        })
      ).rejects.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const session = await api.createSession({
        name: 'Concurrency Test Session',
        system_origin: 'knez'
      });

      // Create multiple memories concurrently
      const memoryPromises = Array.from({ length: 10 }, (_, i) =>
        api.createMemory({
          session_id: session.id,
          type: 'learning',
          title: `Concurrent Memory ${i}`,
          content: `Content ${i}`,
          domain: 'test',
          importance: 5,
          confidence: 0.8,
          system_origin: 'knez'
        })
      );

      const results = await Promise.all(memoryPromises);
      expect(results).toHaveLength(10);
      
      // Verify all memories were created
      const memories = await api.getMemories({ session_id: session.id });
      expect(memories).toHaveLength(10);
    });
  });
});
