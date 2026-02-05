import { test, expect } from '@playwright/test';
import { mockKnezBackend } from './mocks';

test('Chat Reality: Send Message and Correlate', async ({ page }) => {
  await mockKnezBackend(page); // Pre-mock for this test
  await page.goto('/');
  await expect(page.getByText(/KNEZ unreachable/i)).not.toBeVisible({ timeout: 10000 });

  // Setup observation listener
  await page.evaluate(() => {
    (window as any).__TEST_LOGS__ = [];
    window.addEventListener('knez-observation', (e: any) => {
        (window as any).__TEST_LOGS__.push(e.detail);
    });
  });

  // Send message
  const input = page.locator('input[type="text"]');
  await expect(input).toBeVisible();
  await expect(input).toBeEnabled({ timeout: 10000 }); // Wait for readOnly to clear
  await input.fill('Hello KNEZ Verification');
  await input.press('Enter');

  // Verify Streaming UI
  const assistantMsg = page.locator('.bg-zinc-800').last();
  await expect(assistantMsg).toBeVisible();
  
  // Wait for completion
  await expect(assistantMsg).not.toBeEmpty();

  // Correlate with Observer
  const logs = await page.evaluate(() => (window as any).__TEST_LOGS__);
  const sent = logs.find((l: any) => l.event === 'chat_send_attempt');
  const complete = logs.find((l: any) => l.event === 'chat_complete');

  expect(sent).toBeTruthy();
  expect(sent.data.message).toBe('Hello KNEZ Verification');
  expect(complete).toBeTruthy();
});
