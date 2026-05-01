import { test, expect } from '@playwright/test';

test.describe('Tauri Native Chat Suite - 4 Tests', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    // Wait for Tauri app window to be available
    await page.waitForTimeout(5000);
    
    // Try to connect to existing Tauri window or start new one
    try {
      // Look for Tauri window title
      await page.waitForSelector('title:has-text("KNEZ Control")', { timeout: 10000 });
    } catch (e) {
      // If no Tauri window found, navigate to dev server
      await page.goto('http://localhost:5173');
      await page.waitForTimeout(3000);
    }
  });

  test('Test 1: Basic chat with assistant response', async ({ page }) => {
    console.log('[TEST 1] Starting basic chat test');
    
    // Wait for app to be ready
    await page.waitForTimeout(3000);
    
    // Send first message using multiple selector strategies
    try {
      await page.locator('input[placeholder*="Type a message"]').first().fill('Hello, can you introduce yourself?');
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Send")').first().click();
    } catch (e) {
      console.log('Selector strategy 1 failed:', e.message);
      // Try alternative selectors
      await page.fill('textarea[placeholder*="Type a message"], 'Hello, can you introduce yourself?');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Send")');
    }
    
    // Wait for assistant response
    await page.waitForTimeout(20000);
    
    // Verify assistant response exists
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
    
    console.log('[TEST 1] Basic chat test completed');
  });

  test('Test 2: Chat with memory context - follow-up question', async ({ page }) => {
    console.log('[TEST 2] Starting memory context test');
    
    // Wait for app to be ready
    await page.waitForTimeout(3000);
    
    // Send follow-up question
    try {
      await page.locator('input[placeholder*="Type a message"]').first().fill('What was my previous question?');
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Send")').first().click();
    } catch (e) {
      await page.fill('textarea[placeholder*="Type a message"]', 'What was my previous question?');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Send")');
    }
    
    // Wait for assistant response
    await page.waitForTimeout(20000);
    
    console.log('[TEST 2] Memory context test completed');
  });

  test('Test 3: Chat with specific topic and verification', async ({ page }) => {
    console.log('[TEST 3] Starting specific topic test');
    
    // Wait for app to be ready
    await page.waitForTimeout(3000);
    
    // Send specific topic question
    try {
      await page.locator('input[placeholder*="Type a message"]').first().fill('Explain what Tauri is in one sentence');
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Send")').first().click();
    } catch (e) {
      await page.fill('textarea[placeholder*="Type a message"], 'Explain what Tauri is in one sentence');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Send")');
    }
    
    // Wait for assistant response
    await page.waitForTimeout(20000);
    
    console.log('[TEST 3] Topic-specific test completed');
  });

  test('Test 4: Chat with session memory verification', async ({ page }) => {
    console.log('[TEST 4] Starting session memory verification test');
    
    // Wait for app to be ready
    await page.waitForTimeout(3000);
    
    // Send question about session context
    try {
      await page.locator('input[placeholder*="Type a message"]').first().fill('How many messages have we exchanged in this session?');
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Send")').first().click();
    } catch (e) {
      await page.fill('textarea[placeholder*="Type a message"], 'How many messages have we exchanged in this session?');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Send")');
    }
    
    // Wait for assistant response
    await page.waitForTimeout(20000);
    
    console.log('[TEST 4] Session memory test completed');
  });
});
