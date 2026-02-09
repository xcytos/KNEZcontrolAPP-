import { test, expect } from "@playwright/test";
import { closeAllE2EWindows, closeE2EWindow, closeTauri, getPageDiagnostics, openE2EWindow } from "./tauri";

test.describe("TAQWIN MCP", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(360000);

  test.afterEach(async () => {
    await new Promise((r) => setTimeout(r, 600));
  });

  test.afterAll(async () => {
    await closeAllE2EWindows();
    await closeTauri();
  });

  test("starts MCP and runs get_server_status", async () => {
    const { page, label } = await openE2EWindow();
    try {
      await page.waitForTimeout(400);

      await page.keyboard.press("Escape");
      await page.locator('button[title="Chat"]').click();

      await expect(page.getByTitle("TAQWIN Tools")).toBeVisible({ timeout: 30000 });
      await page.getByTitle("TAQWIN Tools").click();
      await expect(page.getByRole("heading", { name: "TAQWIN Tools" })).toBeVisible({ timeout: 30000 });

      await page.getByRole("button", { name: "MCP Config" }).click();
      await expect(page.getByRole("button", { name: "Auto-detect" })).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "Auto-detect" }).click();
      await expect(page.getByRole("button", { name: "Save" })).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page.getByRole("button", { name: "Self-Test" })).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "Self-Test" }).click();
      await page.keyboard.press("Escape");

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });
});
