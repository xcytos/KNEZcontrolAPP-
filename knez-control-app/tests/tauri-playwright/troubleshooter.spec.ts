import { test, expect } from "@playwright/test";
import { connectTauri, setKnezEndpoint } from "./tauri";

test.describe("Tauri Troubleshooter", () => {
  test("navigates core surfaces and records connection failures", async ({}, testInfo) => {
    const { browser, page } = await connectTauri();
    const issues: string[] = [];
    const endpoint = process.env.KNEZ_ENDPOINT ?? "http://127.0.0.1:8000";

    page.on("pageerror", (err) => issues.push(`pageerror:${String(err?.message ?? err)}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") issues.push(`console_error:${msg.text()}`);
    });
    page.on("requestfailed", (req) => {
      const url = req.url();
      const err = req.failure()?.errorText ?? "request_failed";
      if (url.includes("/health") || url.includes("/v1/chat/completions")) issues.push(`requestfailed:${url}:${err}`);
    });

    try {
      await setKnezEndpoint(page, endpoint);

      await page.click("text=Settings");
      await expect(page.getByText("KNEZ Connection")).toBeVisible({ timeout: 30000 });
      await page.click("text=Connection");
      await page.click("text=Check Health");
      await expect.poll(async () => {
        const nodes = await page.locator("div.text-xs.p-2.rounded").count();
        if (nodes === 0) return "none";
        const txt = await page.locator("div.text-xs.p-2.rounded").first().textContent();
        return (txt || "").trim();
      }, { timeout: 45000 }).not.toBe("none");

      await page.click('button[title="Chat"]');
      const input = page.locator('[data-testid="chat-input"]');
      await expect(input).toBeVisible();
      await input.fill("tauri: troubleshooter ping");
      await page.click('[data-testid="chat-send"]');
      const lastAssistant = page.locator('[data-testid="message-bubble"][data-role="knez"]').last();
      await expect(lastAssistant).toBeVisible({ timeout: 60000 });

      await page.click('button[title="Memory"]');
      await expect(page.getByText("Memory Graph")).toBeVisible({ timeout: 30000 });

      await page.click('button[title="Replay"]');
      await expect(page.getByText("Session Replay")).toBeVisible({ timeout: 30000 });

      await page.click('button[title="Reflection"]');
      await expect(page.getByText("Reflection Mode")).toBeVisible({ timeout: 30000 });
    } finally {
      await testInfo.attach("issues.txt", { body: issues.join("\n") || "none", contentType: "text/plain" });
      await browser.close();
    }
  });
});
