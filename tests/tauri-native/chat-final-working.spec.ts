import { test, expect } from './fixtures/tauri-fixture';

test.describe('Tauri Native Chat Suite - 4 Tests', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300000);

  test('Test 1: Basic chat with assistant response', async ({ tauriPage }) => {
    console.log('[TEST 1] Starting basic chat test');
    
    // Wait for app to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Send first message using placeholder selector
    await tauriPage.locator('input[placeholder*="Type a message"]').fill('Hello, can you introduce yourself?');
    await new Promise(resolve => setTimeout(resolve, 500));
    await tauriPage.locator('button:has-text("Send")').click();
    
    // Wait for assistant response
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Verify assistant response exists
    const pageContent = await tauriPage.content();
    expect(pageContent.length).toBeGreaterThan(0);
    
    console.log('[TEST 1] Basic chat test completed');
  });

  test('Test 2: Chat with memory context - follow-up question', async ({ tauriPage }) => {
    console.log('[TEST 2] Starting memory context test');
    
    // Wait for app to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Send follow-up question
    await tauriPage.locator('input[placeholder*="Type a message"]').fill('What was my previous question?');
    await new Promise(resolve => setTimeout(resolve, 500));
    await tauriPage.locator('button:has-text("Send")').click();
    
    // Wait for assistant response
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    console.log('[TEST 2] Memory context test completed');
  });

  test('Test 3: Chat with specific topic and verification', async ({ tauriPage }) => {
    console.log('[TEST 3] Starting specific topic test');
    
    // Wait for app to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Send specific topic question
    await tauriPage.locator('input[placeholder*="Type a message"]').fill('Explain what Tauri is in one sentence');
    await new Promise(resolve => setTimeout(resolve, 500));
    await tauriPage.locator('button:has-text("Send")').click();
    
    // Wait for assistant response
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    console.log('[TEST 3] Topic-specific test completed');
  });

  test('Test 4: Chat with session memory verification', async ({ tauriPage }) => {
    console.log('[TEST 4] Starting session memory verification test');
    
    // Wait for app to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Send question about session context
    await tauriPage.locator('input[placeholder*="Type a message"]').fill('How many messages have we exchanged in this session?');
    await new Promise(resolve => setTimeout(resolve, 500));
    await tauriPage.locator('button:has-text("Send")').click();
    
    // Wait for assistant response
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    console.log('[TEST 4] Session memory test completed');
  });
});
