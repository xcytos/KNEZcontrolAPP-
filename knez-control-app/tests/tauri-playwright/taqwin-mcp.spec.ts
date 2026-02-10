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
      const isTauri = await page.evaluate(() => {
        const w: any = window as any;
        return !!(w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke ?? w.__TAURI_INTERNALS__ ?? w.__TAURI_IPC__);
      });
      expect(isTauri).toBe(true);

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

      const mcpBtn = page.getByTestId("mcp-control");
      await expect(mcpBtn).toBeVisible({ timeout: 30000 });
      await mcpBtn.click();

      const status = page.locator('[data-testid="mcp-status"]');
      await expect(status).toContainText("mcp_state=READY", { timeout: 60000 });
      await expect(status).toContainText("mcp_trust=trusted", { timeout: 60000 });

      await page.getByRole("button", { name: "Advanced" }).click();
      await expect(page.getByRole("button", { name: "Self-Test" })).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "Self-Test" }).click();

      await expect(status).toContainText("mcp_trust=trusted", { timeout: 60000 });

      const diagMid = getPageDiagnostics(page);
      const forbidden = /(switching client framing|fallback|request timeout)/i;
      expect(diagMid.some((l) => forbidden.test(l))).toBe(false);

      const pidRe = /\bpid:\s*(\d+)/g;
      const pids = new Set<string>();
      for (const line of diagMid) {
        for (const m of line.matchAll(pidRe)) {
          if (m[1]) pids.add(m[1]);
        }
      }
      expect(pids.size).toBe(1);

      await page.keyboard.press("Escape");

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });
});
