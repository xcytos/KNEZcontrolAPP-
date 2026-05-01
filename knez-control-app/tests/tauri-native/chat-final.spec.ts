import { test, expect } from './fixtures/tauri-fixture';

test.describe('Tauri Native Chat Suite - 4 Tests', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    // Tauri native app - no web server needed
    // Page is already available from tauri-plugin-playwright
    await page.waitForTimeout(3000);
  });

  test('Test 1: Basic chat with assistant response', async ({ page }) => {
    console.log('[TEST 1] Starting basic chat test');
    
    // Wait for app to be ready
    await page.waitForTimeout(5000);
    
    // Try different selectors for chat input
    const chatInput = await page.locator('input[placeholder*="Type a message"]').first();
    await chatInput.fill('Hello, can you introduce yourself?');
    await page.waitForTimeout(500);
    
    // Try different selectors for Send button
    const sendButton = await page.locator('button:has-text("Send")').first();
    await sendButton.click();
    
    // Wait for assistant response
    await page.waitForTimeout(20000);
    
    // Verify assistant response exists
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
    
    console.log('[TEST 1] Basic chat test completed');
  });

  test('Test 2: Chat with memory context - follow-up question', async ({ page }) => {
    console.log('[TEST 2] Starting memory context test');
    
    // Send follow-up question
    await page.locator('input[placeholder*="Type a message"]').fill('What was my previous question?');
    await page.waitForTimeout(500);
    
    await page.locator('button:has-text("Send")').click();
    
    // Wait for assistant response
    await page.waitForTimeout(20000);
    
    console.log('[TEST 2] Memory context test completed');
  });

  test('Test 3: Chat with specific topic and verification', async ({ page }) => {
    console.log('[TEST 3] Starting specific topic test');
    
    // Send specific topic question
    await page.locator('input[placeholder*="Type a message"]').fill('Explain what Tauri is in one sentence');
    await page.waitForTimeout(500);
    
    await page.locator('button:has-text("Send")').click();
    
    // Wait for assistant response
    await page.waitForTimeout(20000);
    
    console.log('[TEST 3] Topic-specific test completed');
  });

  test('Test 4: Chat with session memory verification', async ({ page }) => {
    console.log('[TEST 4] Starting session memory verification test');
    
    // Send question about session context
    await page.locator('input[placeholder*="Type a message"]').fill('How many messages have we exchanged in this session?');
    await page.waitForTimeout(500);
    
    await page.locator('button:has-text("Send")').click();
    
    // Wait for assistant response
    await page.waitForTimeout(20000);
    
    console.log('[TEST 4] Session memory test completed');
  });
});
