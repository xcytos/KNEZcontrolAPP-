import { test, expect } from '@playwright/test';
import { mockKnezBackend } from './mocks';

test('Failure Injection: Connection Loss', async ({ page }) => {
  await mockKnezBackend(page);
  await page.goto('/');
  await expect(page.getByText(/KNEZ unreachable/i)).not.toBeVisible({ timeout: 10000 });

  // Simulate Network Failure
  // Unroute the success mock first to ensure abort takes precedence
  await page.unroute('**/health');
  await page.route('**/health', route => route.abort());

  // Wait for polling to fail (approx 3-6s)
  await expect(page.getByText(/KNEZ unreachable/i)).toBeVisible({ timeout: 15000 });
  
  // UI should be read-only
  await expect(page.getByText(/read-only mode/i)).toBeVisible();
});
