import { test, expect } from "@playwright/test";
import { closeAllE2EWindows, closeE2EWindow, closeTauri, getPageDiagnostics, openE2EWindow } from "./tauri";

test.describe("TAQWIN MCP", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(360000);

  test.afterAll(async () => {
    await closeAllE2EWindows();
    await closeTauri();
  });

  test("starts MCP and runs get_server_status", async () => {
    test.skip(!process.env.TAQWIN_MCP_E2E, "Set TAQWIN_MCP_E2E=1 to run TAQWIN MCP integration test.");
    const { page, label } = await openE2EWindow();
    try {
      const isTauri = await page.evaluate(() => {
        const w: any = window as any;
        return !!(w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke ?? w.__TAURI_INTERNALS__ ?? w.__TAURI_IPC__);
      });
      expect(isTauri).toBe(true);

      await page.waitForTimeout(150);

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

      const mcpBtn = page.getByTestId("mcp-control");
      await expect(mcpBtn).toBeVisible({ timeout: 30000 });
      await mcpBtn.click();

      const status = page.locator('[data-testid="mcp-status"]');
      await expect(status).toContainText("mcp_trust=trusted", { timeout: 60000 });
      await expect(status).toContainText("mcp_state=INITIALIZED", { timeout: 60000 });

      await page.getByRole("button", { name: "Advanced" }).click();
      await expect(page.getByRole("button", { name: "Self-Test" })).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "Self-Test" }).click();

      await expect(status).toContainText("mcp_trust=trusted", { timeout: 240000 });
      await expect(status).toContainText("mcp_state=READY", { timeout: 240000 });

      const diagMid = getPageDiagnostics(page);
      const firstIndex = (re: RegExp) => diagMid.findIndex((l) => re.test(l));
      const idxInit = firstIndex(/\bMCP request initialize\b/i);
      const idxNotif = firstIndex(/\bMCP notify initialized\b/i);
      const idxList = firstIndex(/\bMCP request tools\/list\b/i);
      const idxCall = firstIndex(/\bMCP request tools\/call\b/i);
      expect(idxInit).toBeGreaterThanOrEqual(0);
      expect(idxNotif).toBeGreaterThan(idxInit);
      expect(idxList).toBeGreaterThan(idxNotif);
      expect(idxCall).toBeGreaterThan(idxList);

      const statusText = await status.innerText();
      const toolsMatch = statusText.match(/\btools=(\d+)\b/);
      const toolsCount = Number(toolsMatch?.[1] ?? 0);
      expect(toolsCount).toBeGreaterThan(0);

      const pidMatch1 = statusText.match(/\bpid=(\d+)\b/);
      const pid1 = Number(pidMatch1?.[1] ?? 0) || null;
      expect(pid1).not.toBeNull();

      await mcpBtn.click();
      await expect(status).toContainText("mcp_state=INITIALIZED", { timeout: 60000 });
      await expect(status).toContainText("mcp_state=READY", { timeout: 240000 });

      const statusText2 = await status.innerText();
      const pidMatch2 = statusText2.match(/\bpid=(\d+)\b/);
      const pid2 = Number(pidMatch2?.[1] ?? 0) || null;
      expect(pid2).not.toBeNull();
      expect(pid2).not.toBe(pid1);

      const diagAfterRestart = getPageDiagnostics(page);
      expect(diagAfterRestart.some((l) => /\bMCP request shutdown\b/i.test(l))).toBe(true);
      expect(diagAfterRestart.some((l) => /\bMCP notify exit\b/i.test(l))).toBe(true);

      await page.keyboard.press("Escape");

      await page.getByTitle("MCP Registry").click();
      await expect(page.getByRole("heading", { name: "MCP Registry" })).toBeVisible({ timeout: 30000 });
      const taqwinCard = page.locator('div').filter({ hasText: "taqwin" }).filter({ hasText: "local_config" }).first();
      await expect(taqwinCard).toBeVisible({ timeout: 30000 });
      await taqwinCard.getByRole("button").filter({ hasText: "Tools" }).first().click();
      await expect(taqwinCard.getByText("tools_cached")).toBeVisible({ timeout: 30000 });
      await expect(taqwinCard.getByText("debug_test")).toBeVisible({ timeout: 30000 });

      const startOnBoot = taqwinCard.locator('input[type="checkbox"]').first();
      await startOnBoot.check();
      await taqwinCard.getByRole("button", { name: "Stop" }).click();
      await expect(taqwinCard.getByText("state")).toBeVisible({ timeout: 30000 });
      await expect(taqwinCard.getByText("READY")).toBeVisible({ timeout: 180000 });

      await page.getByTitle("Menu").click();
      await page.getByRole("button", { name: "Available Tools" }).click();
      await expect(page.getByText("Tools")).toBeVisible({ timeout: 30000 });
      await expect(page.getByText("taqwin__debug_test")).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "Invoke" }).first().click();
      await expect(page.getByText("Invoke Tool")).toBeVisible({ timeout: 30000 });
      await page.locator("textarea").first().fill("{\"message\":\"ping\"}");
      await page.getByRole("button", { name: "Run" }).click();
      await expect(page.getByText("Invoke Tool")).toBeHidden({ timeout: 30000 });

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });
});
