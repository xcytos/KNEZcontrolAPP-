import { test, expect } from "@playwright/test";

test.describe("TAQWIN Tools", () => {
  test("runs a TAQWIN tool and shows result inline", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Chat$/ }).click();

    await page.getByTitle("TAQWIN Tools").click();
    await expect(page.getByText("TAQWIN Tools")).toBeVisible();

    await page.getByRole("button", { name: "Run Tool" }).click();
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByText("succeeded")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("analyze", { exact: true })).toBeVisible();
    await expect(page.getByText("result", { exact: true })).toBeVisible();
  });
});
