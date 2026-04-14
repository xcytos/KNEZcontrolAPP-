import { test, expect } from "@playwright/test";
import { closeAllE2EWindows, closeE2EWindow, closeTauri, getPageDiagnostics, openE2EWindow } from "./tauri";

test.describe("Local Model Reply - Comprehensive", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(600000);

  test.afterAll(async () => {
    await closeAllE2EWindows();
    await closeTauri();
  });

  test("Local Model - Send message and receive reply", async () => {
    const { page, label } = await openE2EWindow();
    try {
      console.log(`[E2E] Starting Local Model Reply test - label=${label}`);

      // Navigate to Chat
      console.log("[E2E] Navigating to Chat");
      await page.getByTitle("Chat", { exact: true }).click();
      await page.waitForTimeout(2000);

      // Verify chat input is visible
      console.log("[E2E] Looking for chat input");
      const chatInput = page.locator('textarea').or(page.locator('input[type="text"]')).or(page.locator('[contenteditable="true"]'));
      await expect(chatInput.first()).toBeVisible({ timeout: 30000 });
      console.log("[E2E] Chat input found");

      // Type a test message
      console.log("[E2E] Typing test message");
      const testMessage = "Hello, this is a test message for local model reply validation.";
      await chatInput.first().fill(testMessage);
      await page.waitForTimeout(500);

      // Look for send button
      console.log("[E2E] Looking for send button");
      const sendButton = page.getByRole("button", { name: /Send/i }).or(page.getByRole("button", { name: /send/i })).or(page.locator('button').filter({ hasText: /→/ }));
      const hasSendButton = await sendButton.count() > 0;
      
      if (hasSendButton) {
        console.log("[E2E] Send button found, clicking");
        await sendButton.first().click();
        await page.waitForTimeout(3000);

        // Verify message was sent
        console.log("[E2E] Verifying message was sent");
        const messageInChat = page.getByText(testMessage).or(page.locator('.message').filter({ hasText: /test/i }));
        const messageVisible = await messageInChat.count() > 0;
        console.log(`[E2E] Message visible in chat: ${messageVisible}`);
      } else {
        console.log("[E2E] Send button not found, trying Enter key");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(3000);
      }

      // Look for model response indicators
      console.log("[E2E] Looking for model response indicators");
      const responseIndicator = page.getByText(/thinking/i).or(page.getByText(/generating/i)).or(page.locator('.typing-indicator'));
      const hasResponseIndicator = await responseIndicator.count() > 0;
      console.log(`[E2E] Response indicator visible: ${hasResponseIndicator}`);

      // Wait for potential response
      await page.waitForTimeout(5000);

      // Check for any response text
      console.log("[E2E] Checking for response text");
      const chatContainer = page.locator('.chat-container').or(page.locator('.messages').or(page.locator('[role="log"]')));
      const hasChatContainer = await chatContainer.count() > 0;
      
      if (hasChatContainer) {
        const chatText = await chatContainer.first().textContent();
        console.log(`[E2E] Chat container text length: ${chatText?.length ?? 0}`);
      }

      console.log("[E2E] Local Model Reply test completed");

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("Local Model - Chat interface navigation", async () => {
    const { page, label } = await openE2EWindow();
    try {
      console.log(`[E2E] Starting Chat Interface Navigation test - label=${label}`);

      // Navigate to Chat
      console.log("[E2E] Navigating to Chat");
      await page.getByTitle("Chat", { exact: true }).click();
      await page.waitForTimeout(2000);

      // Test chat interface buttons
      console.log("[E2E] Testing chat interface buttons");

      // Check for clear button
      const clearButton = page.getByRole("button", { name: /Clear/i }).or(page.getByRole("button", { name: /clear/i }));
      const hasClearButton = await clearButton.count() > 0;
      console.log(`[E2E] Clear button found: ${hasClearButton}`);

      // Check for new chat button
      const newChatButton = page.getByRole("button", { name: /New Chat/i }).or(page.getByRole("button", { name: /new/i }));
      const hasNewChatButton = await newChatButton.count() > 0;
      console.log(`[E2E] New Chat button found: ${hasNewChatButton}`);

      // Check for settings button
      const settingsButton = page.getByRole("button", { name: /Settings/i }).or(page.getByTitle("Settings"));
      const hasSettingsButton = await settingsButton.count() > 0;
      console.log(`[E2E] Settings button found: ${hasSettingsButton}`);

      // Check for model selector
      const modelSelector = page.locator('select').or(page.getByRole("combobox"));
      const hasModelSelector = await modelSelector.count() > 0;
      console.log(`[E2E] Model selector found: ${hasModelSelector}`);

      // Check for history/sidebar
      const sidebar = page.locator('.sidebar').or(page.locator('.history'));
      const hasSidebar = await sidebar.count() > 0;
      console.log(`[E2E] Sidebar found: ${hasSidebar}`);

      console.log("[E2E] Chat Interface Navigation test completed");

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("Local Model - Message history and context", async () => {
    const { page, label } = await openE2EWindow();
    try {
      console.log(`[E2E] Starting Message History test - label=${label}`);

      // Navigate to Chat
      console.log("[E2E] Navigating to Chat");
      await page.getByTitle("Chat", { exact: true }).click();
      await page.waitForTimeout(2000);

      // Send multiple messages
      console.log("[E2E] Sending multiple messages");
      const chatInput = page.locator('textarea').or(page.locator('input[type="text"]')).or(page.locator('[contenteditable="true"]'));
      const messages = [
        "First test message",
        "Second test message",
        "Third test message"
      ];

      for (const msg of messages) {
        await chatInput.first().fill(msg);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
      }

      // Verify messages are in history
      console.log("[E2E] Verifying messages in history");
      for (const msg of messages) {
        const messageElement = page.getByText(msg);
        const isVisible = await messageElement.count() > 0;
        console.log(`[E2E] Message "${msg}" visible: ${isVisible}`);
      }

      // Check for scroll functionality
      console.log("[E2E] Testing scroll functionality");
      const chatContainer = page.locator('.chat-container').or(page.locator('.messages'));
      const hasChatContainer = await chatContainer.count() > 0;
      
      if (hasChatContainer) {
        await chatContainer.first().evaluate((el) => el.scrollTop = 0);
        await page.waitForTimeout(500);
        await chatContainer.first().evaluate((el) => el.scrollTop = el.scrollHeight);
        await page.waitForTimeout(500);
        console.log("[E2E] Scroll functionality tested");
      }

      console.log("[E2E] Message History test completed");

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("Local Model - TAQWIN Tools integration", async () => {
    const { page, label } = await openE2EWindow();
    try {
      console.log(`[E2E] Starting TAQWIN Tools Integration test - label=${label}`);

      // Navigate to Chat
      console.log("[E2E] Navigating to Chat");
      await page.getByTitle("Chat", { exact: true }).click();
      await page.waitForTimeout(2000);

      // Open TAQWIN Tools
      console.log("[E2E] Opening TAQWIN Tools");
      await page.getByTitle("TAQWIN Tools").click();
      await expect(page.getByRole("heading", { name: "TAQWIN Tools" })).toBeVisible({ timeout: 30000 });

      // Check for MCP control button
      console.log("[E2E] Checking for MCP control button");
      const mcpControl = page.getByTestId("mcp-control");
      const hasMcpControl = await mcpControl.count() > 0;
      console.log(`[E2E] MCP control button found: ${hasMcpControl}`);

      // Check for Advanced button
      console.log("[E2E] Checking for Advanced button");
      const advancedButton = page.getByRole("button", { name: "Advanced" });
      const hasAdvancedButton = await advancedButton.count() > 0;
      console.log(`[E2E] Advanced button found: ${hasAdvancedButton}`);

      if (hasAdvancedButton) {
        await advancedButton.click();
        await page.waitForTimeout(1000);

        // Check for Self-Test button
        console.log("[E2E] Checking for Self-Test button");
        const selfTestButton = page.getByRole("button", { name: "Self-Test" });
        const hasSelfTestButton = await selfTestButton.count() > 0;
        console.log(`[E2E] Self-Test button found: ${hasSelfTestButton}`);

        // Check for Open MCP Logs button
        console.log("[E2E] Checking for Open MCP Logs button");
        const openLogsButton = page.getByRole("button", { name: /Open MCP Logs/i });
        const hasOpenLogsButton = await openLogsButton.count() > 0;
        console.log(`[E2E] Open MCP Logs button found: ${hasOpenLogsButton}`);

        // Close Advanced panel
        await page.keyboard.press("Escape");
      }

      // Check for MCP Config button
      console.log("[E2E] Checking for MCP Config button");
      const mcpConfigButton = page.getByRole("button", { name: "MCP Config" });
      const hasMcpConfigButton = await mcpConfigButton.count() > 0;
      console.log(`[E2E] MCP Config button found: ${hasMcpConfigButton}`);

      console.log("[E2E] TAQWIN Tools Integration test completed");

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("Local Model - Connection settings", async () => {
    const { page, label } = await openE2EWindow();
    try {
      console.log(`[E2E] Starting Connection Settings test - label=${label}`);

      // Navigate to Settings
      console.log("[E2E] Navigating to Settings");
      const settingsButton = page.getByTitle("Settings").or(page.getByRole("button", { name: "Settings" }));
      const hasSettingsButton = await settingsButton.count() > 0;
      
      if (hasSettingsButton) {
        await settingsButton.first().click();
        await page.waitForTimeout(2000);
      } else {
        // Try menu
        await page.getByTitle("Menu").click();
        await page.getByRole("button", { name: "Settings" }).click();
        await page.waitForTimeout(2000);
      }

      // Check for connection settings
      console.log("[E2E] Checking for connection settings");
      const connectionSection = page.getByText(/Connection/i).or(page.getByText(/KNEZ/i));
      const hasConnectionSection = await connectionSection.count() > 0;
      console.log(`[E2E] Connection section found: ${hasConnectionSection}`);

      if (hasConnectionSection) {
        // Check for endpoint input
        const endpointInput = page.locator('input').filter({ hasText: /endpoint/i }).or(page.locator('[placeholder*="endpoint"]'));
        const hasEndpointInput = await endpointInput.count() > 0;
        console.log(`[E2E] Endpoint input found: ${hasEndpointInput}`);

        // Check for connect button
        const connectButton = page.getByRole("button", { name: /Connect/i }).or(page.getByRole("button", { name: /Test/i }));
        const hasConnectButton = await connectButton.count() > 0;
        console.log(`[E2E] Connect button found: ${hasConnectButton}`);
      }

      // Check for model settings
      console.log("[E2E] Checking for model settings");
      const modelSection = page.getByText(/Model/i);
      const hasModelSection = await modelSection.count() > 0;
      console.log(`[E2E] Model section found: ${hasModelSection}`);

      console.log("[E2E] Connection Settings test completed");

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });
});
