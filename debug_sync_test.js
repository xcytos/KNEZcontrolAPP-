/**
 * Debug script to test sync functionality
 * Run this in the browser console to diagnose sync issues
 */

// Import the services we need to test
async function testSyncFunctionality() {
  console.log('=== SYNC FUNCTIONALITY DEBUG TEST ===');
  
  try {
    // 1. Test ChatMemorySyncService
    const { getChatMemorySyncService } = await import('./src/services/chat/sync/ChatMemorySyncService.js');
    const syncService = getChatMemorySyncService();
    
    console.log('✅ ChatMemorySyncService loaded');
    
    // 2. Test analyzeAllChats
    console.log('🔍 Testing analyzeAllChats...');
    const analysisResult = await syncService.analyzeAllChats();
    console.log('Analysis result:', analysisResult);
    
    if (analysisResult.candidates.length === 0) {
      console.warn('⚠️ No memory candidates found - this might indicate an issue');
    } else {
      console.log(`✅ Found ${analysisResult.candidates.length} memory candidates`);
    }
    
    // 3. Test session database
    const { sessionDatabase } = await import('./src/services/session/SessionDatabase.js');
    const sessions = await sessionDatabase.getSessions();
    console.log(`✅ Found ${sessions.length} sessions in database`);
    
    if (sessions.length > 0) {
      // Test loading messages for first session
      const firstSession = sessions[0];
      const messages = await sessionDatabase.loadMessages(firstSession.id);
      console.log(`✅ Session ${firstSession.id} has ${messages.length} messages`);
      
      if (messages.length > 0) {
        console.log('Sample messages:', messages.slice(0, 3).map(m => ({
          from: m.from,
          textLength: m.text.length,
          createdAt: m.createdAt
        })));
      }
    }
    
    // 4. Test SimpleMemoryStorage
    const { getSimpleMemoryStorage } = await import('./src/services/memory/storage/SimpleMemoryStorage.js');
    const memoryService = getSimpleMemoryStorage();
    const existingMemories = memoryService.getAllMemories();
    console.log(`✅ Found ${existingMemories.length} existing memories`);
    
    if (existingMemories.length > 0) {
      console.log('Sample memories:', existingMemories.slice(0, 3).map(m => ({
        id: m.id,
        type: m.type,
        title: m.title,
        sourceSessionId: m.sourceSessionId
      })));
    }
    
    // 5. Test sync progress tracking
    if (sessions.length > 0) {
      const testSessionId = sessions[0].id;
      console.log(`🔄 Testing sync for session ${testSessionId}...`);
      
      // Set up progress listener
      const unsubscribe = syncService.onProgressUpdate((progress) => {
        console.log(`📊 Progress: ${progress.progress}% - ${progress.stage}`);
      });
      
      try {
        const syncResult = await syncService.syncSession(testSessionId);
        console.log('✅ Sync result:', syncResult);
      } catch (error) {
        console.error('❌ Sync failed:', error);
      } finally {
        unsubscribe();
      }
    }
    
    console.log('=== DEBUG TEST COMPLETE ===');
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
  }
}

// Test memory creation directly
async function testMemoryCreation() {
  console.log('=== MEMORY CREATION TEST ===');
  
  try {
    const { getSimpleMemoryStorage } = await import('./src/services/memory/storage/SimpleMemoryStorage.js');
    const memoryService = getSimpleMemoryStorage();
    
    // Create a test memory
    const testMemoryId = await memoryService.createMemory(
      'learning',
      'Test Memory Creation',
      'This is a test memory created to verify the storage system is working correctly.',
      'debug',
      ['test', 'debug'],
      { test: true, createdAt: new Date().toISOString() },
      'test-session-id',
      'Test Session',
      ['msg-1', 'msg-2']
    );
    
    console.log(`✅ Created test memory: ${testMemoryId}`);
    
    // Verify it was created
    const allMemories = memoryService.getAllMemories();
    const testMemory = allMemories.find(m => m.id === testMemoryId);
    
    if (testMemory) {
      console.log('✅ Test memory found in storage:', testMemory);
    } else {
      console.error('❌ Test memory not found after creation');
    }
    
    // Clean up
    await memoryService.deleteMemory(testMemoryId);
    console.log('✅ Test memory cleaned up');
    
  } catch (error) {
    console.error('❌ Memory creation test failed:', error);
  }
}

// Export functions for console use
window.testSyncFunctionality = testSyncFunctionality;
window.testMemoryCreation = testMemoryCreation;

console.log('🔧 Debug functions loaded. Run testSyncFunctionality() or testMemoryCreation() in console');
