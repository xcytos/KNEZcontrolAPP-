import { ChatMessage } from '../../domain/DataContracts';
import { sessionDatabase } from './SessionDatabase';
import { inMemoryDatabase } from './InMemoryDatabase';

/**
 * Migrates data from IndexedDB to InMemory database
 * Used when IndexedDB is having issues
 */
export class DatabaseMigration {
  
  /**
   * Migrates all sessions and messages from IndexedDB to InMemory database
   */
  static async migrateAllData(): Promise<void> {
    console.log('Starting database migration from IndexedDB to InMemory...');
    
    try {
      // Get all sessions from IndexedDB
      const sessions = await sessionDatabase.getSessions();
      console.log(`Found ${sessions.length} sessions to migrate`);
      
      for (const session of sessions) {
        try {
          // Migrate session
          await inMemoryDatabase.saveSession(session.id, session.name);
          
          // Get messages for this session
          const messages = await sessionDatabase.loadMessages(session.id);
          console.log(`Migrating ${messages.length} messages for session ${session.id}`);
          
          // Convert and save messages
          if (messages.length > 0) {
            const chatMessages: ChatMessage[] = messages.map(msg => ({
              id: msg.id,
              sessionId: msg.sessionId,
              from: msg.from as any,
              text: msg.text,
              createdAt: msg.createdAt,
              sequenceNumber: msg.sequenceNumber,
              metrics: msg.metrics,
              toolCall: msg.toolCall,
              refusal: msg.refusal,
              isPartial: msg.isPartial,
              deliveryStatus: msg.deliveryStatus,
              deliveryError: msg.deliveryError,
              replyToMessageId: msg.replyToMessageId,
              correlationId: msg.correlationId
            }));
            
            await inMemoryDatabase.saveMessages(session.id, chatMessages);
          }
          
          console.log(`Successfully migrated session ${session.id}`);
        } catch (error) {
          console.error(`Failed to migrate session ${session.id}:`, error);
        }
      }
      
      console.log('Database migration completed');
      
      // Show migration stats
      const stats = inMemoryDatabase.getStats();
      console.log(`InMemory database now contains:`, stats);
      
    } catch (error) {
      console.error('Database migration failed:', error);
      throw error;
    }
  }
  
  /**
   * Creates sample data for testing when no real data exists
   */
  static async createSampleData(): Promise<void> {
    console.log('Creating sample data for testing...');
    
    const sampleSessionId = 'a96be8cb63ce4745a9c379d80345d489';
    
    // Create sample session
    await inMemoryDatabase.saveSession(sampleSessionId, 'Hii');
    
    // Create sample messages
    const sampleMessages: ChatMessage[] = [
      {
        id: 'msg_1',
        sessionId: sampleSessionId,
        from: 'user',
        text: 'Hello, can you help me with something?',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        sequenceNumber: 1
      },
      {
        id: 'msg_2', 
        sessionId: sampleSessionId,
        from: 'assistant',
        text: 'I learned that helping users requires understanding their specific needs. This teaches me to ask clarifying questions before providing solutions.',
        createdAt: new Date(Date.now() - 3500000).toISOString(),
        sequenceNumber: 2
      },
      {
        id: 'msg_3',
        sessionId: sampleSessionId,
        from: 'user',
        text: 'I need help with debugging a sync issue in my application.',
        createdAt: new Date(Date.now() - 3400000).toISOString(),
        sequenceNumber: 3
      },
      {
        id: 'msg_4',
        sessionId: sampleSessionId,
        from: 'assistant',
        text: 'I found that the root cause was IndexedDB timeouts. The key insight is that we need fallback mechanisms when primary storage fails.',
        createdAt: new Date(Date.now() - 3300000).toISOString(),
        sequenceNumber: 4
      }
    ];
    
    await inMemoryDatabase.saveMessages(sampleSessionId, sampleMessages);
    
    // Create second sample session
    const sampleSessionId2 = '95ca18906f0847d6b923ab1eee7a4a01';
    await inMemoryDatabase.saveSession(sampleSessionId2, 'Hii');
    
    const sampleMessages2: ChatMessage[] = [
      {
        id: 'msg_5',
        sessionId: sampleSessionId2,
        from: 'user',
        text: 'Can you explain how memory systems work?',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        sequenceNumber: 1
      },
      {
        id: 'msg_6',
        sessionId: sampleSessionId2,
        from: 'assistant',
        text: 'I understand that memory systems need to store, retrieve, and update information efficiently. The important lesson is that persistence layers can fail and need robust error handling.',
        createdAt: new Date(Date.now() - 7100000).toISOString(),
        sequenceNumber: 2
      },
      {
        id: 'msg_7',
        sessionId: sampleSessionId2,
        from: 'user',
        text: 'What are the best practices for database design?',
        createdAt: new Date(Date.now() - 7000000).toISOString(),
        sequenceNumber: 3
      },
      {
        id: 'msg_8',
        sessionId: sampleSessionId2,
        from: 'assistant',
        text: 'I discovered that database design should include fallback mechanisms, timeout handling, and graceful degradation. This shows that reliability is more important than perfection.',
        createdAt: new Date(Date.now() - 6900000).toISOString(),
        sequenceNumber: 4
      }
    ];
    
    await inMemoryDatabase.saveMessages(sampleSessionId2, sampleMessages2);
    
    console.log('Sample data created successfully');
    
    const stats = inMemoryDatabase.getStats();
    console.log('InMemory database stats:', stats);
  }
}
