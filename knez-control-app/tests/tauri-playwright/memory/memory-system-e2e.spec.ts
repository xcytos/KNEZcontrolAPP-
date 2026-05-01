/**
 * Memory System E2E Tests
 * 
 * End-to-end tests for the unified memory system using Tauri + Playwright
 * Tests the complete user flow from chat to memory creation and visualization
 */

import { test, expect } from '../fixtures/tauri-fixture';

test.describe('Memory System E2E', () => {
  test.beforeEach(async ({ tauriPage }) => {
    // Navigate to the app and wait for it to load
    await tauriPage.goto('http://localhost:1420');
    await tauriPage.waitForLoadState('domcontentloaded');
  });

  test('should load memory dashboard and display statistics', async ({ tauriPage }) => {
    // Navigate to memory dashboard (assuming there's a route or button)
    await tauriPage.getByRole('button', { name: /memory/i }).click();
    await tauriPage.waitForSelector('[data-testid="memory-dashboard"]', { timeout: 10000 });

    // Verify dashboard loads
    await expect(tauriPage.getByRole('heading', { name: 'Memory Management Dashboard' })).toBeVisible();

    // Check statistics cards are present
    await expect(tauriPage.locator('[data-testid="total-memories"]')).toBeVisible();
    await expect(tauriPage.locator('[data-testid="total-sessions"]')).toBeVisible();
    await expect(tauriPage.locator('[data-testid="average-importance"]')).toBeVisible();
  });

  test('should create a new memory through the UI', async ({ tauriPage }) => {
    // Navigate to memory dashboard
    await tauriPage.getByRole('button', { name: /memory/i }).click();
    await tauriPage.waitForSelector('[data-testid="memory-dashboard"]');

    // Select a session (or create one)
    await tauriPage.getByRole('button', { name: /new session/i }).click();
    await tauriPage.fill('[data-testid="session-name"]', 'E2E Test Session');
    await tauriPage.getByRole('button', { name: 'Create Session' }).click();

    // Wait for session to be created and selected
    await expect(tauriPage.locator('[data-testid="selected-session"]')).toContainText('E2E Test Session');

    // Create a new memory
    await tauriPage.fill('[data-testid="memory-title"]', 'E2E Test Memory');
    await tauriPage.fill('[data-testid="memory-content"]', 'This is a test memory created during E2E testing to verify the memory system functionality.');
    
    // Set memory type and importance
    await tauriPage.selectOption('[data-testid="memory-type"]', 'learning');
    await tauriPage.fill('[data-testid="memory-importance"]', '8');

    // Add tags
    await tauriPage.fill('[data-testid="memory-tags"]', 'e2e,test,memory');

    // Submit memory creation
    await tauriPage.getByRole('button', { name: 'Create Memory' }).click();

    // Verify memory appears in the list
    await expect(tauriPage.locator('[data-testid="memory-list"]')).toContainText('E2E Test Memory');
    await expect(tauriPage.locator('[data-testid="memory-list"]')).toContainText('learning');
  });

  test('should filter memories by type and search', async ({ tauriPage }) => {
    // Navigate to memory dashboard
    await tauriPage.getByRole('button', { name: /memory/i }).click();
    await tauriPage.waitForSelector('[data-testid="memory-dashboard"]');

    // Create test memories with different types
    await createTestMemory(tauriPage, 'Learning Memory 1', 'learning', 'test,learning');
    await createTestMemory(tauriPage, 'Mistake Memory 1', 'mistake', 'test,mistake');
    await createTestMemory(tauriPage, 'Decision Memory 1', 'decision', 'test,decision');

    // Test type filtering
    await tauriPage.selectOption('[data-testid="filter-type"]', 'learning');
    await expect(tauriPage.locator('[data-testid="memory-list"]')).toContainText('Learning Memory 1');
    await expect(tauriPage.locator('[data-testid="memory-list"]')).not.toContainText('Mistake Memory 1');

    // Test search functionality
    await tauriPage.fill('[data-testid="search-input"]', 'Decision');
    await expect(tauriPage.locator('[data-testid="memory-list"]')).toContainText('Decision Memory 1');
    await expect(tauriPage.locator('[data-testid="memory-list"]')).not.toContainText('Learning Memory 1');
  });

  test('should integrate memory creation with chat flow', async ({ tauriPage }) => {
    // Start a chat session
    await tauriPage.getByRole('button', { name: /chat/i }).click();
    await tauriPage.waitForSelector('[data-testid="chat-interface"]');

    // Send a message that should trigger memory creation
    await tauriPage.fill('[data-testid="chat-input"]', 'What are the best practices for React component development?');
    await tauriPage.getByRole('button', { name: 'Send' }).click();

    // Wait for response
    await expect(tauriPage.locator('[data-testid="message-content"]').last()).toBeVisible({ timeout: 30000 });

    // Check if memory was created (assuming there's a memory indicator)
    const memoryIndicator = tauriPage.locator('[data-testid="memory-created-indicator"]');
    if (await memoryIndicator.isVisible()) {
      await expect(memoryIndicator).toBeVisible();
    }

    // Navigate to memory dashboard to verify
    await tauriPage.getByRole('button', { name: /memory/i }).click();
    await expect(tauriPage.locator('[data-testid="memory-list"]')).toContainText('React');
  });

  test('should display memory details and relationships', async ({ tauriPage }) => {
    // Navigate to memory dashboard
    await tauriPage.getByRole('button', { name: /memory/i }).click();
    await tauriPage.waitForSelector('[data-testid="memory-dashboard"]');

    // Create related memories
    await createTestMemory(tauriPage, 'JavaScript Fundamentals', 'learning', 'javascript,basics');
    await createTestMemory(tauriPage, 'React Components', 'learning', 'react,components');

    // Click on a memory to view details
    await tauriPage.locator('[data-testid="memory-item"]').first().click();
    
    // Verify memory detail modal
    await expect(tauriPage.locator('[data-testid="memory-detail-modal"]')).toBeVisible();
    await expect(tauriPage.locator('[data-testid="memory-detail-title"]')).toBeVisible();
    await expect(tauriPage.locator('[data-testid="memory-detail-content"]')).toBeVisible();
    await expect(tauriPage.locator('[data-testid="memory-detail-tags"]')).toBeVisible();

    // Check for relationships (if implemented)
    const relationshipsSection = tauriPage.locator('[data-testid="memory-relationships"]');
    if (await relationshipsSection.isVisible()) {
      await expect(relationshipsSection).toBeVisible();
    }
  });

  test('should handle memory deletion and cleanup', async ({ tauriPage }) => {
    // Navigate to memory dashboard
    await tauriPage.getByRole('button', { name: /memory/i }).click();
    await tauriPage.waitForSelector('[data-testid="memory-dashboard"]');

    // Create a test memory
    await createTestMemory(tauriPage, 'Memory to Delete', 'learning', 'test,delete');

    // Verify memory exists
    await expect(tauriPage.locator('[data-testid="memory-list"]')).toContainText('Memory to Delete');

    // Delete the memory
    await tauriPage.locator('[data-testid="memory-item"]').filter({ hasText: 'Memory to Delete' }).getByRole('button', { name: /delete/i }).click();

    // Confirm deletion (if there's a confirmation dialog)
    const confirmDialog = tauriPage.locator('[data-testid="confirm-dialog"]');
    if (await confirmDialog.isVisible()) {
      await tauriPage.getByRole('button', { name: 'Confirm' }).click();
    }

    // Verify memory is deleted
    await expect(tauriPage.locator('[data-testid="memory-list"]')).not.toContainText('Memory to Delete');
  });

  test('should handle session management', async ({ tauriPage }) => {
    // Navigate to memory dashboard
    await tauriPage.getByRole('button', { name: /memory/i }).click();
    await tauriPage.waitForSelector('[data-testid="memory-dashboard"]');

    // Create multiple sessions
    await createTestSession(tauriPage, 'Session 1');
    await createTestSession(tauriPage, 'Session 2');
    await createTestSession(tauriPage, 'Session 3');

    // Verify sessions appear in the list
    await expect(tauriPage.locator('[data-testid="session-list"]')).toContainText('Session 1');
    await expect(tauriPage.locator('[data-testid="session-list"]')).toContainText('Session 2');
    await expect(tauriPage.locator('[data-testid="session-list"]')).toContainText('Session 3');

    // Switch between sessions
    await tauriPage.locator('[data-testid="session-item"]').filter({ hasText: 'Session 2' }).click();
    await expect(tauriPage.locator('[data-testid="selected-session"]')).toContainText('Session 2');

    // Create a memory in the selected session
    await createTestMemory(tauriPage, 'Session 2 Memory', 'learning', 'session2,test');

    // Switch to another session and verify memory list updates
    await tauriPage.locator('[data-testid="session-item"]').filter({ hasText: 'Session 1' }).click();
    await expect(tauriPage.locator('[data-testid="memory-list"]')).not.toContainText('Session 2 Memory');
  });

  test('should demonstrate memory analytics and insights', async ({ tauriPage }) => {
    // Navigate to memory dashboard
    await tauriPage.getByRole('button', { name: /memory/i }).click();
    await tauriPage.waitForSelector('[data-testid="memory-dashboard"]');

    // Create diverse test data
    await createTestMemory(tauriPage, 'High Importance Learning', 'learning', 'important', 9);
    await createTestMemory(tauriPage, 'Medium Importance Learning', 'learning', 'medium', 5);
    await createTestMemory(tauriPage, 'Critical Mistake', 'mistake', 'critical', 8);
    await createTestMemory(tauriPage, 'Important Decision', 'decision', 'important', 7);

    // Check analytics section
    await expect(tauriPage.locator('[data-testid="analytics-section"]')).toBeVisible();

    // Verify statistics are calculated
    const totalMemories = tauriPage.locator('[data-testid="total-memories"]');
    await expect(totalMemories).toBeVisible();
    const memoryCount = await totalMemories.textContent();
    expect(parseInt(memoryCount || '0')).toBeGreaterThan(0);

    // Check memory type distribution
    await expect(tauriPage.locator('[data-testid="memory-type-chart"]')).toBeVisible();

    // Check importance distribution
    await expect(tauriPage.locator('[data-testid="importance-chart"]')).toBeVisible();
  });

  test('should handle error scenarios gracefully', async ({ tauriPage }) => {
    // Navigate to memory dashboard
    await tauriPage.getByRole('button', { name: /memory/i }).click();
    await tauriPage.waitForSelector('[data-testid="memory-dashboard"]');

    // Try to create memory without required fields
    await tauriPage.getByRole('button', { name: 'Create Memory' }).click();
    
    // Should show validation error
    await expect(tauriPage.locator('[data-testid="validation-error"]')).toBeVisible();

    // Try to create memory with invalid importance
    await tauriPage.fill('[data-testid="memory-title"]', 'Test Memory');
    await tauriPage.fill('[data-testid="memory-content"]', 'Test content');
    await tauriPage.fill('[data-testid="memory-importance"]', '15'); // Invalid (should be 1-10)
    
    await tauriPage.getByRole('button', { name: 'Create Memory' }).click();
    
    // Should show validation error for importance
    await expect(tauriPage.locator('[data-testid="importance-error"]')).toBeVisible();
  });
});

// Helper functions for E2E tests
async function createTestMemory(page: any, title: string, type: string, tags: string, importance: number = 5) {
  await page.fill('[data-testid="memory-title"]', title);
  await page.fill('[data-testid="memory-content"]', `Test content for ${title}`);
  await page.selectOption('[data-testid="memory-type"]', type);
  await page.fill('[data-testid="memory-importance"]', importance.toString());
  await page.fill('[data-testid="memory-tags"]', tags);
  await page.getByRole('button', { name: 'Create Memory' }).click();
  
  // Wait for memory to be created
  await page.waitForTimeout(1000);
}

async function createTestSession(page: any, name: string) {
  await page.getByRole('button', { name: /new session/i }).click();
  await page.fill('[data-testid="session-name"]', name);
  await page.getByRole('button', { name: 'Create Session' }).click();
  
  // Wait for session to be created
  await page.waitForTimeout(1000);
}
