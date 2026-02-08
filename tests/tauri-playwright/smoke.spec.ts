import { test, expect } from "@playwright/test";
import { closeAllE2EWindows, closeE2EWindow, closeTauri, openE2EWindow, setKnezEndpoint } from "./tauri";

test.describe("Tauri E2E", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await new Promise((r) => setTimeout(r, 600));
  });

  test.afterAll(async () => {
    await closeAllE2EWindows();
    await closeTauri();
  });

  test("delivery check: send hi and receive response", async () => {
    const { page, label } = await openE2EWindow();
    try {
      const endpoint = process.env.KNEZ_ENDPOINT ?? "http://127.0.0.1:8000";
      await setKnezEndpoint(page, endpoint);
      await page.waitForTimeout(400);

      await page.click('button[title="Chat"]');
      const input = page.locator('[data-testid="chat-input"]');
      await expect(input).toBeVisible();
      await input.fill("hi");
      await page.click('[data-testid="chat-send"]');

      const lastAssistant = page.locator('[data-testid="message-bubble"][data-role="knez"]').last();
      await expect(lastAssistant).toBeVisible({ timeout: 60000 });
      await expect(lastAssistant).not.toHaveText(/waiting for response/i, { timeout: 60000 });
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("TAQWIN + MCP UI is visible and shows actionable errors", async () => {
    const { page, label } = await openE2EWindow();
    try {
      await page.waitForTimeout(400);

      await page.click('button[title="Chat"]');
      await expect(page.locator('button[title="TAQWIN Tools"]')).toBeVisible({ timeout: 30000 });
      await page.click('button[title="TAQWIN Tools"]');
      await expect(page.getByText("TAQWIN Tools")).toBeVisible({ timeout: 30000 });

      await expect(page.getByText(/Start TAQWIN MCP|Restart TAQWIN MCP/)).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(/Open MCP Logs/)).toBeVisible({ timeout: 30000 });
    } finally {
      await closeE2EWindow(label);
    }
  });
});
