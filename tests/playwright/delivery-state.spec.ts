import { test, expect } from '@playwright/test';
import { setKnezEndpoint } from './mocks';

test('Chat does not get stuck pending on unreachable backend', async ({ page }) => {
  await setKnezEndpoint(page, 'http://127.0.0.1:1');

  const input = page.locator('input[type="text"]').first();
  await expect(input).toBeVisible();
  await input.fill('hello');
  await input.press('Enter');

  const lastAssistant = page.locator('[data-testid="message-bubble"][data-role="knez"]').last();
  await expect(lastAssistant).toBeVisible({ timeout: 15000 });
  await expect(lastAssistant.getByText('queued', { exact: true })).toBeVisible({ timeout: 15000 });

  const lastUser = page.locator('[data-testid="message-bubble"][data-role="user"]').last();
  await expect(lastUser).toBeVisible();
  await expect(lastUser.getByText('pending', { exact: true })).toHaveCount(0);
});

test('Sidebar shows error marker on logs after chat failure', async ({ page }) => {
  await setKnezEndpoint(page, 'http://127.0.0.1:1');

  const input = page.locator('input[type="text"]').first();
  await expect(input).toBeVisible();
  await input.fill('hello');
  await input.press('Enter');

  const lastAssistant = page.locator('[data-testid="message-bubble"][data-role="knez"]').last();
  await expect(lastAssistant).toBeVisible({ timeout: 15000 });
  await expect(lastAssistant.getByText('queued', { exact: true })).toBeVisible({ timeout: 15000 });

  await expect(page.getByTestId('sidebar-error-logs')).toBeVisible({ timeout: 15000 });
});
