import { test, expect } from '@playwright/test';
import { mockKnezBackend } from './mocks';

test('Boot & Trust Test: Launch KNEZ and Verify Health', async ({ page }) => {
  // 1. Launch App (Web Preview)
  await page.goto('/');

  // 2. Verify Initial State
  const statusIndicator = page.getByText(/KNEZ unreachable/i);
  await expect(statusIndicator).toBeVisible();

  // 3. Click Launch
  const launchButton = page.getByRole('button', { name: /Launch KNEZ/i });
  if (await launchButton.isVisible()) {
      await launchButton.click();
  }

  // Inject Backend Mock NOW (simulating "Server Started")
  await mockKnezBackend(page);

  // 4. Expect Status Transition
  // When connected, the "unreachable" banner disappears and readOnly mode ends
  await expect(page.getByText(/KNEZ unreachable/i)).not.toBeVisible({ timeout: 10000 });
  
  // Verify Chat Input is present (proving we are in active mode)
  await expect(page.locator('input[type="text"]')).toBeVisible();

  // 5. Verify Backend Health Badge (Infrastructure Panel or similar indicator if visible)
  // For now, absence of error banner is the primary signal of trust
});

