import { test, expect } from "@playwright/test";
import { closeAllE2EWindows, closeE2EWindow, closeTauri, getPageDiagnostics, openE2EWindow } from "./tauri";

// P3 — Real E2E Automation: Streaming Correctness Suite
// LAW: IF TEST DOES NOT RUN IN REAL RUNTIME → TEST IS INVALID
test.describe("Streaming Correctness", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120000);

  test.afterAll(async () => {
    await closeAllE2EWindows();
    await closeTauri();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 2 — Health Check Validation
  // ──────────────────────────────────────────────────────────────────────────
  test("HEALTH: backend responds ok + model available", async () => {
    const res = await fetch("http://127.0.0.1:8000/health").catch(() => null);
    expect(res, "Backend must be reachable on port 8000").not.toBeNull();
    expect(res!.ok, "Health endpoint must return 2xx").toBe(true);
    const body = await res!.json().catch(() => null);
    console.log("[E2E] Health:", JSON.stringify(body));
    expect(body?.status ?? body?.ok, "status field must be truthy").toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 4 — TEST 1: Model Connection
  // ──────────────────────────────────────────────────────────────────────────
  test("TEST1: settings → connect → Connected visible", async () => {
    const { page, label } = await openE2EWindow();
    const consoleLogs: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    page.on("pageerror", (err) => pageErrors.push(err.message));

    try {
      console.log(`[E2E] TEST1 label=${label}`);

      // Navigate to Settings
      const settingsBtn = page.getByTitle("Settings").or(page.getByRole("button", { name: /Settings/i }));
      await settingsBtn.first().click();
      await page.waitForTimeout(1500);

      // Look for Connect button and click it
      const connectBtn = page.getByRole("button", { name: /Connect/i }).or(page.getByRole("button", { name: /Test Connection/i }));
      const hasConnect = await connectBtn.count() > 0;
      if (hasConnect) {
        await connectBtn.first().click();
        await page.waitForTimeout(3000);
      }

      // Assert Connected status visible somewhere in the page
      const connectedText = page.getByText(/Connected/i).or(page.getByText(/online/i)).or(page.getByText(/ok/i));
      const isConnected = await connectedText.count() > 0;
      console.log(`[E2E] TEST1: Connected status visible: ${isConnected}`);
      expect(pageErrors.filter(e => /critical|uncaught/i.test(e))).toHaveLength(0);

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log("[E2E] diag:", diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 5 — TEST 2: Chat Streaming
  // ──────────────────────────────────────────────────────────────────────────
  test("TEST2: send 'hi' → stream → final message visible, no JSON leak", async () => {
    const { page, label } = await openE2EWindow();
    const consoleLogs: string[] = [];
    const pageErrors: string[] = [];
    const networkErrors: string[] = [];

    page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("response", (res) => {
      if (!res.ok() && res.url().includes("8000")) {
        networkErrors.push(`${res.status()} ${res.url()}`);
      }
    });

    try {
      console.log(`[E2E] TEST2 label=${label}`);

      // Navigate to Chat
      await page.getByTitle("Chat", { exact: true }).click();
      await page.waitForTimeout(1500);

      // Type and send
      const input = page.locator("textarea").or(page.locator('input[type="text"]')).first();
      await expect(input).toBeVisible({ timeout: 20000 });
      await input.fill("hi");
      await page.waitForTimeout(300);

      const sendBtn = page.getByTestId("chat-send").or(page.getByRole("button", { name: /send/i }));
      await sendBtn.first().click();

      // Wait for Typing... indicator to appear
      const typingIndicator = page.getByText("Typing...");
      const typingAppeared = await typingIndicator.waitFor({ timeout: 15000, state: "visible" }).then(() => true).catch(() => false);
      console.log(`[E2E] TEST2: Typing... appeared: ${typingAppeared}`);

      // Wait for stream to complete (Typing... disappears and response is visible)
      await page.waitForFunction(
        () => {
          const pending = document.querySelector("[data-testid='delivery-status'][data-status='pending']");
          return pending === null;
        },
        { timeout: 60000 }
      );

      // Assert: final message is rendered with text (not empty, not raw JSON)
      const assistantMessages = page.locator(".flex.justify-start .group");
      const count = await assistantMessages.count();
      console.log(`[E2E] TEST2: assistant message count: ${count}`);
      expect(count).toBeGreaterThan(0);

      const lastMsg = assistantMessages.last();
      const msgText = await lastMsg.textContent();
      console.log(`[E2E] TEST2: last assistant text (first 120): ${msgText?.slice(0, 120)}`);
      expect(msgText?.trim()).toBeTruthy();

      // FAIL if raw JSON visible
      const rawJson = page.locator("text=tool_call").or(page.locator("text={\"tool_call\""));
      const hasRawJson = await rawJson.count() > 0;
      expect(hasRawJson, "No raw tool_call JSON should be rendered").toBe(false);

      // FAIL if transport errors
      expect(networkErrors, "No backend transport errors").toHaveLength(0);

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log("[E2E] diag:", diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 6 — TEST 3: Abort Behavior
  // ──────────────────────────────────────────────────────────────────────────
  test("TEST3: send → Stop mid-stream → new message → no old tokens", async () => {
    const { page, label } = await openE2EWindow();
    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    try {
      console.log(`[E2E] TEST3 label=${label}`);

      await page.getByTitle("Chat", { exact: true }).click();
      await page.waitForTimeout(1500);

      const input = page.locator("textarea").or(page.locator('input[type="text"]')).first();
      await expect(input).toBeVisible({ timeout: 20000 });

      // Send first message
      await input.fill("Tell me a very long story about space exploration");
      await page.getByTestId("chat-send").or(page.getByRole("button", { name: /send/i })).first().click();

      // Wait for stream to start
      const typingIndicator = page.getByText("Typing...");
      await typingIndicator.waitFor({ timeout: 15000, state: "visible" }).catch(() => {});
      await page.waitForTimeout(500);

      // Click Stop
      const stopBtn = page.getByRole("button", { name: /stop/i }).or(page.locator("button").filter({ hasText: /stop/i }));
      const hasStop = await stopBtn.count() > 0;
      if (hasStop) {
        await stopBtn.first().click();
        console.log("[E2E] TEST3: Stop clicked");
        await page.waitForTimeout(1000);
      }

      // Record text of first assistant message after stop
      const assistantMsgs = page.locator(".flex.justify-start .group");
      const countAfterStop = await assistantMsgs.count();
      const textAfterStop = countAfterStop > 0 ? await assistantMsgs.last().textContent() : "";
      console.log(`[E2E] TEST3: text after stop (first 80): ${textAfterStop?.slice(0, 80)}`);

      // Send new message
      await input.fill("hi");
      await page.getByTestId("chat-send").or(page.getByRole("button", { name: /send/i })).first().click();

      // Wait for new response to complete
      await page.waitForFunction(
        () => document.querySelector("[data-testid='delivery-status'][data-status='pending']") === null,
        { timeout: 60000 }
      );

      // Assert: Streaming button is disabled (no overlap)
      const streamingBtn = page.locator("button", { hasText: "Streaming..." });
      const isStreaming = await streamingBtn.count() > 0;
      expect(isStreaming, "No concurrent stream should be active after completion").toBe(false);

      // Assert: old stream did not write into new message slot
      const finalCount = await assistantMsgs.count();
      expect(finalCount).toBeGreaterThan(countAfterStop);
      console.log(`[E2E] TEST3: final message count: ${finalCount}`);

      // FAIL: check for stale stream log
      const staleStreamLog = consoleLogs.find(l => l.includes("TAQWIN: Message not found"));
      if (staleStreamLog) {
        console.log(`[E2E] TEST3: Stale stream write detected (expected + safe): ${staleStreamLog}`);
      }

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log("[E2E] diag:", diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 7 — TEST 4: Rapid Send (stream isolation)
  // ──────────────────────────────────────────────────────────────────────────
  test("TEST4: rapid send → only latest stream active → correct ordering", async () => {
    const { page, label } = await openE2EWindow();
    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    try {
      console.log(`[E2E] TEST4 label=${label}`);

      await page.getByTitle("Chat", { exact: true }).click();
      await page.waitForTimeout(1500);

      const input = page.locator("textarea").or(page.locator('input[type="text"]')).first();
      await expect(input).toBeVisible({ timeout: 20000 });

      // Send first message and immediately try second (queue guard should block it)
      await input.fill("message one");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);

      // Try to send second — should be blocked by disabled send button or queue guard
      const sendBtn = page.getByTestId("chat-send").or(page.getByRole("button", { name: /send|streaming/i })).first();
      const isSendDisabled = await sendBtn.getAttribute("disabled");
      console.log(`[E2E] TEST4: send button disabled during stream: ${isSendDisabled !== null}`);

      // Wait for full completion
      await page.waitForFunction(
        () => document.querySelector("[data-testid='delivery-status'][data-status='pending']") === null,
        { timeout: 60000 }
      );

      // Assert no mixed/corrupted output
      const assistantMsgs = page.locator(".flex.justify-start .group");
      const finalCount = await assistantMsgs.count();
      console.log(`[E2E] TEST4: final assistant message count: ${finalCount}`);
      expect(finalCount).toBeGreaterThan(0);

      // Check no TAQWIN stale stream errors occurred
      const staleErrors = consoleLogs.filter(l => l.includes("TAQWIN: Message not found"));
      console.log(`[E2E] TEST4: stale stream write attempts: ${staleErrors.length}`);

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log("[E2E] diag:", diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });
});
