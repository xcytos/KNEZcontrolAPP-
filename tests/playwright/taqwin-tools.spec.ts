import { test, expect } from "@playwright/test";

test.describe("TAQWIN Tools", () => {
  test("runs a TAQWIN tool and shows result inline", async ({ page }) => {
    await page.goto("/");
    const isTauri = await page.evaluate(() => {
      const w: any = window as any;
      return !!w.__TAURI_INTERNALS__ || !!w.__TAURI__ || !!w.__TAURI_IPC__;
    });
    test.skip(!isTauri, "TAQWIN MCP tools require the desktop (Tauri) runtime");
    await page.getByRole("button", { name: /^Chat$/ }).click();

    await page.getByTitle("TAQWIN Tools").click();
    await expect(page.getByText("TAQWIN Tools")).toBeVisible();

    await page.getByRole("button", { name: "Run Tool" }).click();
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByText("succeeded")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("result", { exact: true })).toBeVisible();
  });
});
