import { test, expect } from '@playwright/test';
import { mockKnezBackend } from './mocks';

test('Perception: Snapshot Capture', async ({ page }) => {
  await mockKnezBackend(page);
  await page.goto('/');
  await expect(page.getByText(/KNEZ unreachable/i)).not.toBeVisible({ timeout: 10000 });

  // Open Perception Panel (toggle view)
  await expect(page.getByTitle('Toggle Perception')).toBeVisible();
  await page.getByTitle('Toggle Perception').click();
  
  const captureBtn = page.getByRole('button', { name: /Capture View/i });
  await expect(captureBtn).toBeVisible();

  // Click Capture
  await captureBtn.click();

  // Verify Image Appears
  const img = page.locator('img[alt="Perception"]');
  await expect(img).toBeVisible({ timeout: 5000 });
  
  // Verify src data
  const src = await img.getAttribute('src');
  expect(src).toContain('data:image/png;base64');
});
