import { test, expect } from '@playwright/test';
import { mockKnezBackend } from './mocks';

test('MCP: Registry Toggle', async ({ page }) => {
  await mockKnezBackend(page);
  await page.goto('/');
  await expect(page.getByText(/KNEZ unreachable/i)).not.toBeVisible({ timeout: 10000 });

  // Navigate to MCP View
  await expect(page.getByTitle('MCP Registry')).toBeVisible();
  await page.getByTitle('MCP Registry').click();

  // Find an item
  const item = page.locator('.bg-zinc-900').filter({ hasText: 'filesystem-local' });
  await expect(item).toBeVisible();

  // Toggle it (Disable)
  const toggleBtn = item.getByRole('button');
  const initialText = await toggleBtn.textContent();
  
  await toggleBtn.click();
  
  // Expect state change (Mock toggles instantly or with delay)
  // If active -> Disable -> Enable
  if (initialText?.includes('Disable')) {
      await expect(toggleBtn).toHaveText('Enable');
      await expect(item.locator('.bg-zinc-700')).toBeVisible(); // Health stripe gray
  } else {
      await expect(toggleBtn).toHaveText('Disable');
      await expect(item.locator('.bg-green-500')).toBeVisible(); // Health stripe green
  }
});
