import { test, expect } from "@playwright/test";
import { connectTauri, setKnezEndpoint } from "./tauri";

test.describe("Tauri Smoke", () => {
  test("boots and shows sidebar", async () => {
    const { browser, page } = await connectTauri();
    try {
      await page.waitForSelector("#root");
      await expect(page.locator('button[title="Chat"]')).toBeVisible();
      await expect(page.locator('button[title="System Logs"]')).toBeVisible();
      await expect(page.locator('button[title="System Console"]')).toBeVisible();
    } finally {
      await browser.close();
    }
  });

  test("streams assistant response quickly when backend is reachable", async () => {
    const { browser, page } = await connectTauri();
    try {
      const endpoint = process.env.KNEZ_ENDPOINT ?? "http://127.0.0.1:8000";
      await setKnezEndpoint(page, endpoint);
      await page.click('button[title="Chat"]');

      const input = page.locator('[data-testid="chat-input"]');
      await expect(input).toBeVisible();
      await input.fill("tauri: streaming check");
      await page.click('[data-testid="chat-send"]');

      const lastAssistant = page.locator('[data-testid="message-bubble"][data-role="knez"]').last();
      await expect(lastAssistant).toBeVisible({ timeout: 30000 });
      await expect(lastAssistant.locator("text=tokens")).toBeVisible({ timeout: 30000 });

      const getCompletionState = async () => {
        const statusCount = await lastAssistant.locator('[data-testid="delivery-status"]').count();
        const cursorCount = await lastAssistant.locator('[data-testid="partial-cursor"]').count();
        const waitingCount = await lastAssistant.locator("text=waiting for response").count();
        const tokenVisible = await lastAssistant.locator("text=tokens").isVisible();
        if (!tokenVisible) return "not_ready";
        if (waitingCount > 0) return "waiting";
        if (statusCount > 0) return "in_flight";
        if (cursorCount > 0) return "partial";
        return "done";
      };

      await expect.poll(getCompletionState, { timeout: 120000 }).toBe("done");
    } finally {
      await browser.close();
    }
  });

  test("TAQWIN tools surface errors instead of hanging", async () => {
    const { browser, page } = await connectTauri();
    try {
      const endpoint = process.env.KNEZ_ENDPOINT ?? "http://127.0.0.1:8000";
      await setKnezEndpoint(page, endpoint);
      await page.click('button[title="Chat"]');

      await page.click('button[title="TAQWIN Tools"]');
      await expect(page.getByText("TAQWIN Tools")).toBeVisible({ timeout: 30000 });

      const getOutcome = async () => {
        const toolCount = await page.locator("div.text-xs.font-mono.text-zinc-200").count();
        if (toolCount > 0) return "tools";
        
        const errorCount = await page.locator("div.text-red-300").count();
        if (errorCount > 0) {
           const err = await page.locator("div.text-red-300").first().textContent();
           return `error:${(err || "").trim()}`;
        }
        return "loading";
      };

      await expect.poll(getOutcome, { timeout: 60000 }).not.toBe("loading");
      const outcome = await getOutcome();

      if (outcome.startsWith("error:")) {
        const errText = outcome.slice("error:".length).trim();
        await expect(page.getByText("mcp_request_timeout", { exact: false })).toHaveCount(0);
        if (/TAQWIN MCP closed unexpectedly/i.test(errText)) {
          throw new Error(`TAQWIN tools MCP start failed: ${errText}`);
        }
      }
      await expect(page.getByText("mcp_process_closed", { exact: false })).toHaveCount(0);
    } finally {
      await browser.close();
    }
  });
});
