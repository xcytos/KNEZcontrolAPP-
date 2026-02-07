import { test, expect } from '@playwright/test';
import { isKnezReachable, setKnezEndpoint, waitForKnezReachable } from './mocks';

test('KNEZ User Journey: Live Runtime Verification', async ({ page }) => {
  const endpoint = process.env.KNEZ_ENDPOINT ?? 'http://localhost:8000';
  await setKnezEndpoint(page, endpoint);
  await page.goto('/');

  if (!(await isKnezReachable(page, endpoint))) {
    const launchButton = page.getByRole('button', { name: /Launch KNEZ/i });
    if (await launchButton.isVisible({ timeout: 2000 })) {
      await launchButton.click();
    }
    await waitForKnezReachable(page, endpoint, 20000);
  }

  await expect(page.getByText(/KNEZ unreachable/i)).not.toBeVisible({ timeout: 20000 });

  const input = page.locator('input[type="text"]');
  await expect(input).toBeVisible();
  await expect(input).toBeEnabled();
  await input.fill('Hello Real World');
  await input.press('Enter');
  
  await expect(page.locator('[data-testid="message-bubble"][data-role="knez"]').last()).toBeVisible({ timeout: 30000 });
  
  await page.getByTitle('Agent Loop').click();
  await expect(page.getByText(/Autonomous Agent/i)).toBeVisible();

  await page.getByTitle('System Logs').click();
  await expect(page.getByText(/KNEZ: ONLINE/i)).toBeVisible({ timeout: 10000 });
});
