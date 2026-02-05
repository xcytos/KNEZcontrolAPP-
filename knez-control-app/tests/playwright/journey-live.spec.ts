import { test, expect } from '@playwright/test';

test('KNEZ User Journey: Live Runtime Verification', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // 1. Boot
  await page.goto('/');

  // 2. Handle Connection State
  // In live mode, backend might be already running or not.
  // We check if "Launch" button is visible.
  
  try {
    const launchButton = page.getByRole('button', { name: /Launch KNEZ/i });
    if (await launchButton.isVisible({ timeout: 5000 })) {
      console.log("Launch button visible. Clicking...");
      await launchButton.click();
    } else {
      console.log("Launch button not visible. Assuming already connected.");
    }
  } catch (e) {
    console.log("Launch button check skipped/failed", e);
  }

  // 3. Verify Connection (Real)
  // Wait for "KNEZ connected" or absence of "unreachable"
  await expect(page.getByText(/KNEZ unreachable/i)).not.toBeVisible({ timeout: 15000 });
  
  // 4. Verify Chat Capability (Real)
  const input = page.locator('input[type="text"]');
  await expect(input).toBeVisible();
  await expect(input).toBeEnabled();
  await input.fill('Hello Real World');
  await input.press('Enter');
  
  // Wait for response from real backend
  // Note: Real backend might take longer than mock
  await expect(page.locator('[data-testid="message-bubble"][data-role="knez"]').last()).toBeVisible({ timeout: 30000 });
  
  // 5. Verify Sidebar & Navigation
  await page.getByTitle('Agent Loop').click();
  await expect(page.getByText(/Autonomous Agent/i)).toBeVisible();

  // 6. Verify Logs Panel (New Feature)
  await page.getByTitle('System Logs').click();
  await expect(page.getByText(/KNEZ: ONLINE/i)).toBeVisible({ timeout: 10000 });
});
