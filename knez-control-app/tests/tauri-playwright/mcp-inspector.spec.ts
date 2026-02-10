import { test, expect } from "@playwright/test";
import { closeAllE2EWindows, closeE2EWindow, closeTauri, openE2EWindow } from "./tauri";

test.describe("MCP Inspector", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300000);

  test.afterAll(async () => {
    await closeAllE2EWindows();
    await closeTauri();
  });

  test("opens MCP Registry Inspector tab", async () => {
    const { page, label } = await openE2EWindow();
    try {
      await page.getByTitle("Chat", { exact: true }).click();
      await expect(page.getByTitle("TAQWIN Tools")).toBeVisible({ timeout: 30000 });
      await page.getByTitle("TAQWIN Tools").click();
      await expect(page.getByRole("heading", { name: "TAQWIN Tools" })).toBeVisible({ timeout: 30000 });

      await page.getByRole("button", { name: "MCP Config" }).click();
      await expect(page.getByRole("button", { name: "Auto-detect" })).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "Auto-detect" }).click();
      await expect(page.getByRole("button", { name: "Save" })).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "Save" }).click();
      await page.keyboard.press("Escape");

      await page.getByTitle("MCP Registry").click();
      await expect(page.getByRole("heading", { name: "MCP Registry" })).toBeVisible({ timeout: 30000 });

      await page.getByRole("button", { name: "Inspector" }).click();
      await expect(page.getByText("MCP Config")).toBeVisible({ timeout: 30000 });
      await expect(page.getByText("Servers", { exact: true })).toBeVisible({ timeout: 30000 });

      const serverButtons = page.locator('button:has(.font-mono)');
      await expect(serverButtons.first()).toBeVisible({ timeout: 30000 });
    } finally {
      await closeE2EWindow(label);
    }
  });
});
