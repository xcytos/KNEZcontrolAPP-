import { test, expect } from '@playwright/test';
import { mockKnezBackend } from './mocks';

test('Agent Loop: Autonomous Execution', async ({ page }) => {
  await mockKnezBackend(page);
  await page.goto('/');
  await expect(page.getByText(/KNEZ unreachable/i)).not.toBeVisible({ timeout: 10000 });

  // Navigate to Agent View
  await expect(page.getByTitle('Agent Loop')).toBeVisible();
  await page.getByTitle('Agent Loop').click();

  const input = page.locator('input[placeholder*="Research"]');
  const startBtn = page.getByRole('button', { name: /Start Task/i });

  await input.fill('Verify Playwright Integration');
  await startBtn.click();

  // Verify State Transition
  await expect(page.getByText('THINKING')).toBeVisible();
  
  // Verify Step Stream
  await expect(page.getByText(/Analyzing goal/i)).toBeVisible();
  
  // Wait for Finish
  await expect(page.getByText('FINISHED', { exact: true })).toBeVisible({ timeout: 10000 });
});
