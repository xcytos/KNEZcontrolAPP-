import { test, expect } from '@playwright/test';
import { mockKnezBackend } from './mocks';

test('Orchestration Idempotency: Double Click Launch', async ({ page }) => {
  await page.goto('/');

  const launchButton = page.getByRole('button', { name: /Launch KNEZ/i });
  
  if (await launchButton.isVisible()) {
      // Click twice rapidly
      await launchButton.click();
      await launchButton.click();
  }

  // Inject Backend Mock NOW
  await mockKnezBackend(page);

  // Verify no "duplicate process" error or stuck state
  await expect(page.getByText(/KNEZ unreachable/i)).not.toBeVisible({ timeout: 10000 });
  
  // Verify we didn't crash or show error toast
  await expect(page.getByText(/Failed to spawn/i)).not.toBeVisible();
});
