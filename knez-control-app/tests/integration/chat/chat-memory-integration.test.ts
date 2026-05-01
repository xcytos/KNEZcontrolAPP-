/**
 * Chat Memory Integration Tests
 * 
 * Tests the integration between chat functionality and the unified memory system,
 * including memory injection, awareness, and training data verification.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getUnifiedMemoryAPI } from '../../../src/services/memory/shared/UnifiedMemoryAPI';
import { UnifiedMemoryDatabase } from '../../../src/services/memory/shared/UnifiedMemoryDatabase';
import { ChatService } from '../../../src/services/ChatService';

describe('Chat Memory Integration', () => {
  let database: UnifiedMemoryDatabase;
  let memoryApi: ReturnType<typeof getUnifiedMemoryAPI>;
  let chatService: ChatService;
  let testDbPath: string;

  beforeAll(async () => {
    // Use test-specific database
    testDbPath = '.taqwin/memory/test_chat_memory.db';
    database = new UnifiedMemoryDatabase(testDbPath);
    await database.initialize();
    
    memoryApi = getUnifiedMemoryAPI();
    chatService = new ChatService();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await database.getDatabase().exec('DELETE FROM memories');
    await database.getDatabase().exec('DELETE FROM sessions');
    await database.getDatabase().exec('DELETE FROM memory_relations');
    
    // Reset chat service state
    chatService.reset();
  });

  describe('Memory Injection into Chat', () => {
    it('should inject relevant memories into chat context', async () => {
      // Create training data memories
      const session = await memoryApi.createSession({
        name: 'Training Session',
        system_origin: 'unified' as const,
        outcome: 'success',
        tags: ['training', 'chat'],
        metadata: { purpose: 'chat_memory_testing' }
      });

      // Create relevant memories about React development
      await memoryApi.createMemory({
        session_id: session.id,
        type: 'learning' as const,
        title: 'React Component Best Practices',
        content: 'React components should be pure functions that receive props and return JSX. Use functional components with hooks for state management.',
        domain: 'development',
        importance: 9,
        tags: ['react', 'components', 'best-practices'],
        confidence: 0.95,
        system_origin: 'unified' as const
      });

      await memoryApi.createMemory({
        session_id: session.id,
        title: 'TypeScript with React',
        content: 'TypeScript provides type safety for React components. Use interfaces for props and useState with proper typing.',
        type: 'learning' as const,
        domain: 'development',
        importance: 8,
        tags: ['typescript', 'react', 'types'],
        confidence: 0.9,
        system_origin: 'unified' as const
      });

      await memoryApi.createMemory({
        session_id: session.id,
        title: 'Common React Mistakes',
        content: 'Common mistakes include not using keys in lists, mutating state directly, and not cleaning up useEffect.',
        type: 'mistake' as const,
        domain: 'development',
        importance: 7,
        tags: ['react', 'mistakes', 'common-errors'],
        confidence: 1.0,
        system_origin: 'unified' as const
      });

      // Test memory search and retrieval
      const reactMemories = await memoryApi.searchMemories({
        query: 'React components',
        type: undefined,
        domain: 'development',
        limit: 10
      });

      expect(reactMemories.length).toBeGreaterThan(0);
      expect(reactMemories[0].content).toContain('React');

      // Verify memories are properly categorized
      const learningMemories = await memoryApi.getMemories({ type: 'learning' });
      const mistakeMemories = await memoryApi.getMemories({ type: 'mistake' });
      
      expect(learningMemories.length).toBe(2);
      expect(mistakeMemories.length).toBe(1);
    });

    it('should provide memory context for chat sessions', async () => {
      // Create session-specific memories
      const chatSession = await memoryApi.createSession({
        name: 'Chat Session - React Questions',
        system_origin: 'knez' as const,
        outcome: 'active',
        tags: ['chat', 'react-help'],
        metadata: { chat_context: 'react_development' }
      });

      // Add memories about specific React concepts
      const hookMemory = await memoryApi.createMemory({
        session_id: chatSession.id,
        type: 'learning' as const,
        title: 'React Hooks Guide',
        content: 'useState manages component state, useEffect handles side effects, and useContext manages global state. Custom hooks can extract reusable logic.',
        domain: 'development',
        importance: 8,
        tags: ['react', 'hooks', 'state-management'],
        confidence: 0.9,
        system_origin: 'knez' as const
      });

      // Test memory retrieval by session
      const sessionMemories = await memoryApi.getMemories({ 
        session_id: chatSession.id 
      });

      expect(sessionMemories).toHaveLength(1);
      expect(sessionMemories[0].title).toBe('React Hooks Guide');

      // Test memory relations
      await memoryApi.createRelation({
        source_memory_id: hookMemory.id,
        target_memory_id: hookMemory.id, // Self-relation for example
        relationship_type: 'builds_on',
        system_origin: 'knez' as const,
        metadata: { context: 'hook_concepts' }
      });

      const relations = await memoryApi.getMemoryRelations(hookMemory.id);
      expect(relations).toHaveLength(1);
      expect(relations[0].relationship_type).toBe('builds_on');
    });
  });

  describe('Memory Awareness in Chat', () => {
    it('should track chat interactions and create memories', async () => {
      // Simulate a chat session that should generate memories
      const chatSession = await memoryApi.createSession({
        name: 'User Chat - Performance Issues',
        system_origin: 'knez' as const,
        outcome: 'resolved',
        tags: ['user-chat', 'performance'],
        metadata: { 
          user_query: 'React performance optimization',
          resolution_type: 'guidance_provided'
        }
      });

      // Create a memory from the chat interaction
      const performanceMemory = await memoryApi.createMemory({
        session_id: chatSession.id,
        type: 'learning' as const,
        title: 'React Performance Optimization Techniques',
        content: 'Use React.memo for component memoization, useMemo for expensive calculations, and useCallback for function references. Avoid unnecessary re-renders by optimizing props and state.',
        domain: 'development',
        importance: 9,
        tags: ['react', 'performance', 'optimization'],
        confidence: 0.85,
        system_origin: 'knez' as const
      });

      // Verify the memory was created with proper context
      const retrievedMemory = await memoryApi.getMemory(performanceMemory.id);
      expect(retrievedMemory).toBeTruthy();
      expect(retrievedMemory?.title).toContain('Performance');
      expect(retrievedMemory?.tags).toContain('optimization');

      // Test analytics reflect the new memory
      const analytics = await memoryApi.getMemoryAnalytics();
      expect(analytics.total_memories).toBeGreaterThan(0);
      expect(analytics.memories_by_domain).toHaveProperty('development');
    });

    it('should demonstrate memory relationships and knowledge graph', async () => {
      // Create interconnected memories
      const session = await memoryApi.createSession({
        name: 'Knowledge Graph Test',
        system_origin: 'unified' as const,
        outcome: 'success',
        tags: ['test', 'knowledge-graph']
      });

      // Create base memory
      const baseMemory = await memoryApi.createMemory({
        session_id: session.id,
        type: 'learning' as const,
        title: 'JavaScript Fundamentals',
        content: 'JavaScript is a prototype-based language with first-class functions. Key concepts include closures, prototypes, and async programming.',
        domain: 'development',
        importance: 10,
        tags: ['javascript', 'fundamentals', 'programming'],
        confidence: 1.0,
        system_origin: 'unified' as const
      });

      // Create related memory
      const reactMemory = await memoryApi.createMemory({
        session_id: session.id,
        type: 'learning' as const,
        title: 'React and JavaScript',
        content: 'React builds on JavaScript fundamentals. Understanding JS concepts like closures and prototypes is essential for advanced React development.',
        domain: 'development',
        importance: 8,
        tags: ['react', 'javascript', 'advanced'],
        confidence: 0.9,
        system_origin: 'unified' as const
      });

      // Create mistake memory
      const mistakeMemory = await memoryApi.createMemory({
        session_id: session.id,
        type: 'mistake' as const,
        title: 'Common JavaScript Mistakes in React',
        content: 'Forgetting that this behaves differently in arrow functions, not understanding closure scope, and misusing async/await in React components.',
        domain: 'development',
        importance: 7,
        tags: ['javascript', 'react', 'mistakes'],
        confidence: 1.0,
        system_origin: 'unified' as const
      });

      // Create relationships
      await memoryApi.createRelation({
        source_memory_id: baseMemory.id,
        target_memory_id: reactMemory.id,
        relationship_type: 'prerequisite_for',
        system_origin: 'unified' as const
      });

      await memoryApi.createRelation({
        source_memory_id: reactMemory.id,
        target_memory_id: mistakeMemory.id,
        relationship_type: 'helps_avoid',
        system_origin: 'unified' as const
      });

      // Verify knowledge graph structure
      const baseRelations = await memoryApi.getMemoryRelations(baseMemory.id);
      expect(baseRelations).toHaveLength(1);
      expect(baseRelations[0].relationship_type).toBe('prerequisite_for');

      const reactRelations = await memoryApi.getMemoryRelations(reactMemory.id);
      expect(reactRelations).toHaveLength(1);
      expect(reactRelations[0].relationship_type).toBe('helps_avoid');

      // Test search finds related content
      const searchResults = await memoryApi.searchMemories({
        query: 'JavaScript React',
        limit: 10
      });
      expect(searchResults.length).toBeGreaterThan(0);
    });
  });

  describe('Training Data Verification', () => {
    it('should create comprehensive training dataset', async () => {
      // Create training session
      const trainingSession = await memoryApi.createSession({
        name: 'AI Training Data - Development Best Practices',
        system_origin: 'unified' as const,
        outcome: 'completed',
        tags: ['training', 'ai', 'best-practices'],
        metadata: { 
          training_purpose: 'chat_assistant_improvement',
          data_quality: 'verified',
          last_updated: new Date().toISOString()
        }
      });

      // Create diverse training memories
      const trainingMemories = [
        {
          title: 'Code Review Best Practices',
          content: 'Effective code reviews focus on logic, readability, and maintainability. Provide constructive feedback and suggest improvements.',
          type: 'learning' as const,
          importance: 9,
          tags: ['code-review', 'best-practices', 'collaboration']
        },
        {
          title: 'Debugging Systematic Approach',
          content: 'Start with reproducing the issue, isolate variables, use debugging tools, and verify fixes with tests.',
          type: 'learning' as const,
          importance: 8,
          tags: ['debugging', 'systematic', 'problem-solving']
        },
        {
          title: 'API Design Principles',
          content: 'RESTful APIs should be stateless, use proper HTTP methods, have clear documentation, and handle errors gracefully.',
          type: 'learning' as const,
          importance: 9,
          tags: ['api', 'design', 'rest']
        },
        {
          title: 'Testing Pyramid Mistake',
          content: 'Relying too heavily on E2E tests and neglecting unit tests leads to slow feedback loops and brittle tests.',
          type: 'mistake' as const,
          importance: 7,
          tags: ['testing', 'mistake', 'strategy']
        },
        {
          title: 'Performance Optimization Decision',
          content: 'Chose to implement virtual scrolling instead of pagination for large datasets to improve user experience.',
          type: 'decision' as const,
          importance: 6,
          tags: ['performance', 'ux', 'decision']
        }
      ];

      const createdMemories = [];
      for (const memoryData of trainingMemories) {
        const memory = await memoryApi.createMemory({
          session_id: trainingSession.id,
          ...memoryData,
          domain: 'development',
          confidence: 0.9,
          system_origin: 'unified' as const
        });
        createdMemories.push(memory);
      }

      // Verify training data quality
      expect(createdMemories).toHaveLength(5);

      // Test different memory types are represented
      const analytics = await memoryApi.getMemoryAnalytics();
      expect(analytics.memories_by_type).toHaveProperty('learning', 3);
      expect(analytics.memories_by_type).toHaveProperty('mistake', 1);
      expect(analytics.memories_by_type).toHaveProperty('decision', 1);

      // Test search across training data
      const codeSearch = await memoryApi.searchMemories({
        query: 'code review',
        limit: 5
      });
      expect(codeSearch.length).toBeGreaterThan(0);
      expect(codeSearch[0].tags).toContain('code-review');

      // Test filtering by importance
      const highImportance = await memoryApi.getMemories({ 
        importance: 8 
      });
      expect(highImportance.length).toBe(3); // Only memories with importance >= 8
    });

    it('should verify memory consistency and integrity', async () => {
      // Create test data with known relationships
      const session = await memoryApi.createSession({
        name: 'Integrity Test Session',
        system_origin: 'unified' as const,
        outcome: 'success',
        tags: ['test', 'integrity']
      });

      const memory1 = await memoryApi.createMemory({
        session_id: session.id,
        type: 'learning' as const,
        title: 'Test Memory 1',
        content: 'First test memory for integrity checking',
        domain: 'test',
        importance: 5,
        tags: ['test', 'integrity'],
        confidence: 0.8,
        system_origin: 'unified' as const
      });

      const memory2 = await memoryApi.createMemory({
        session_id: session.id,
        type: 'learning' as const,
        title: 'Test Memory 2',
        content: 'Second test memory for integrity checking',
        domain: 'test',
        importance: 6,
        tags: ['test', 'integrity'],
        confidence: 0.85,
        system_origin: 'unified' as const
      });

      // Create bidirectional relationship
      await memoryApi.createRelation({
        source_memory_id: memory1.id,
        target_memory_id: memory2.id,
        relationship_type: 'related_to',
        system_origin: 'unified' as const
      });

      await memoryApi.createRelation({
        source_memory_id: memory2.id,
        target_memory_id: memory1.id,
        relationship_type: 'related_to',
        system_origin: 'unified' as const
      });

      // Verify integrity
      const mem1Relations = await memoryApi.getMemoryRelations(memory1.id);
      const mem2Relations = await memoryApi.getMemoryRelations(memory2.id);

      expect(mem1Relations).toHaveLength(1);
      expect(mem2Relations).toHaveLength(1);

      // Test update maintains consistency
      await memoryApi.updateMemory(memory1.id, {
        title: 'Updated Test Memory 1',
        importance: 7
      });

      const updatedMemory = await memoryApi.getMemory(memory1.id);
      expect(updatedMemory?.title).toBe('Updated Test Memory 1');
      expect(updatedMemory?.importance).toBe(7);

      // Relations should remain intact
      const mem1RelationsAfterUpdate = await memoryApi.getMemoryRelations(memory1.id);
      expect(mem1RelationsAfterUpdate).toHaveLength(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      const session = await memoryApi.createSession({
        name: 'Performance Test Session',
        system_origin: 'unified' as const,
        outcome: 'success',
        tags: ['performance', 'test']
      });

      // Create many memories
      const startTime = performance.now();
      const memoryPromises = [];

      for (let i = 0; i < 100; i++) {
        memoryPromises.push(
          memoryApi.createMemory({
            session_id: session.id,
            type: i % 3 === 0 ? 'learning' : i % 3 === 1 ? 'mistake' : 'decision',
            title: `Performance Test Memory ${i}`,
            content: `Test content for memory ${i} with various keywords and search terms`,
            domain: 'test',
            importance: Math.floor(Math.random() * 10) + 1,
            tags: [`tag${i % 10}`, `category${i % 5}`],
            confidence: 0.8 + (Math.random() * 0.2),
            system_origin: 'unified' as const
          })
        );
      }

      const createdMemories = await Promise.all(memoryPromises);
      const creationTime = performance.now() - startTime;

      expect(createdMemories).toHaveLength(100);
      expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test search performance
      const searchStart = performance.now();
      const searchResults = await memoryApi.searchMemories({
        query: 'Test content',
        limit: 50
      });
      const searchTime = performance.now() - searchStart;

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(1000); // Search should be fast

      // Test analytics performance
      const analyticsStart = performance.now();
      const analytics = await memoryApi.getMemoryAnalytics();
      const analyticsTime = performance.now() - analyticsStart;

      expect(analytics.total_memories).toBe(100);
      expect(analyticsTime).toBeLessThan(500); // Analytics should be very fast
    });
  });
});
