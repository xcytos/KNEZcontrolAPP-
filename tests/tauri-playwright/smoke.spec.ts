import { test, expect } from "@playwright/test";
import { closeAllE2EWindows, closeE2EWindow, closeTauri, getPageDiagnostics, openE2EWindow } from "./tauri";

test.describe("Tauri E2E", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240000);

  test.afterEach(async () => {
    await new Promise((r) => setTimeout(r, 600));
  });

  test.afterAll(async () => {
    await closeAllE2EWindows();
    await closeTauri();
  });

  test("TAQWIN MCP registry loads tools", async () => {
    const { page, label } = await openE2EWindow();
    try {
      console.log(`[E2E] Start test label=${label} url=${page.url()}`);
      await page.waitForTimeout(400);

      console.log("[E2E] Click Chat");
      await page.getByTitle("Chat", { exact: true }).click();

      console.log("[E2E] Open TAQWIN Tools");
      await expect(page.getByTitle("TAQWIN Tools")).toBeVisible({ timeout: 30000 });
      await page.getByTitle("TAQWIN Tools").click();
      await expect(page.getByRole("heading", { name: "TAQWIN Tools" })).toBeVisible({ timeout: 30000 });

      await expect(page.getByText(/Open MCP Logs/)).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole("button", { name: /TAQWIN MCP/ })).toBeVisible({ timeout: 30000 });
      await expect(page.getByText("MCP Config")).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "Advanced" }).click();
      await expect(page.getByRole("button", { name: "Self-Test" })).toBeVisible({ timeout: 30000 });
      const diag = getPageDiagnostics(page);
      console.log(`[E2E] Summary label=${label} url=${page.url()} diagnostics=${diag.length}`);
      if (diag.length) console.log(diag.join("\n"));
      await page.keyboard.press("Escape");
    } finally {
      await closeE2EWindow(label);
    }
  });
});
