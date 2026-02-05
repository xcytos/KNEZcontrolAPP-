import { test, expect } from '@playwright/test';
import { mockKnezBackend } from './mocks';

test('KNEZ User Journey: Full Feature Verification', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // 1. Boot
  await page.goto('/');
  await expect(page.getByText(/KNEZ unreachable/i)).toBeVisible();

  // Debug: Check if button exists
  const btnCount = await page.getByRole('button', { name: /Launch KNEZ/i }).count();
  console.log("Launch Buttons found:", btnCount);

  // 2. Launch
  const launchButton = page.getByRole('button', { name: /Launch KNEZ/i });
  
  if (btnCount === 0) {
      console.log("DUMPING CONTENT:");
      console.log(await page.content());
  }

  await launchButton.click();

  // 3. Inject Truth (Mock Backend)
  await mockKnezBackend(page);

  // 4. Verify Connection
  await expect(page.getByText(/KNEZ unreachable/i)).not.toBeVisible({ timeout: 10000 });
  
  // 5. Verify Chat Capability
  const input = page.locator('input[type="text"]');
  await expect(input).toBeVisible();
  await expect(input).toBeEnabled();
  await input.fill('Hello Journey');
  await input.press('Enter');
  
  await expect(page.locator('[data-testid="message-bubble"][data-role="knez"]').last()).toContainText('Hello there!');

  // 6. Verify Sidebar & Navigation
  await page.getByTitle('Agent Loop').click();
  await expect(page.getByText(/Autonomous Agent/i)).toBeVisible();

  await page.getByTitle('MCP Registry').click();
  await expect(page.getByText(/filesystem-local/i)).toBeVisible();

  await page.getByTitle('Chat').click(); 
  await page.getByTitle('Toggle Perception').click();
  await expect(page.getByRole('button', { name: /Capture View/i })).toBeVisible();

  // 7. Verify Persistence
  await page.getByTitle('Memory').click();
  await expect(page.getByText(/Memory Graph/i)).toBeVisible();
});
