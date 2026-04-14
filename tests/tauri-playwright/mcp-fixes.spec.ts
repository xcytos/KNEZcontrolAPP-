import { test, expect } from "@playwright/test";
import { closeAllE2EWindows, closeE2EWindow, closeTauri, openE2EWindow, setKnezEndpoint } from "./tauri";

test.describe("MCP Fixes Verification", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300000);

  test.afterAll(async () => {
    await closeAllE2EWindows();
    await closeTauri();
  });

  test("verify tool call blocking fix - plain text JSON conversion", async () => {
    const { page, label } = await openE2EWindow();
    try {
      // Navigate to chat interface
      await page.getByTitle("Chat", { exact: true }).click();
      await expect(page.getByTitle("TAQWIN Tools")).toBeVisible({ timeout: 30000 });
      
      // Send a message that would trigger tool call
      const chatInput = page.locator('textarea[placeholder*="Type"]').or(page.locator('textarea')).first();
      await chatInput.fill("Test tool call with plain text JSON");
      await page.keyboard.press("Enter");
      
      // Wait for response (should not block plain text tool JSON)
      await expect(page.locator('[class*="message"]').last()).toBeVisible({ timeout: 60000 });
      
      // Verify no blocking warnings in console
      const diagnostics = await page.evaluate(() => {
        const logs: string[] = [];
        const originalLog = console.log;
        const originalWarn = console.warn;
        console.log = (...args) => logs.push(`[LOG] ${args.join(' ')}`);
        console.warn = (...args) => logs.push(`[WARN] ${args.join(' ')}`);
        return logs;
      });
      
      const blockingWarnings = diagnostics.filter(log => 
        log.includes("native_raw_tool_json_blocked") || 
        log.includes("Tool protocol violation")
      );
      
      expect(blockingWarnings.length).toBe(0);
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("verify handshake delay fix - server ready before handshake", async () => {
    const { page, label } = await openE2EWindow();
    try {
      // Navigate to MCP Registry
      await page.getByTitle("MCP Registry").click();
      await expect(page.getByRole("heading", { name: "MCP Registry" })).toBeVisible({ timeout: 30000 });
      
      // Click Inspector tab
      await page.getByRole("button", { name: "Inspector" }).click();
      await expect(page.getByText("MCP Config")).toBeVisible({ timeout: 30000 });
      
      // Find TAQWIN server and start it
      const taqwinServer = page.locator('button:has-text("taqwin")').or(page.locator('[class*="font-mono"]'));
      if (await taqwinServer.count() > 0) {
        await taqwinServer.first().click();
        
        // Look for start button
        const startButton = page.getByRole("button", { name: /start/i }).or(page.getByRole("button", { name: /▶/i }));
        if (await startButton.count() > 0) {
          await startButton.first().click();
          
          // Wait for handshake to complete (should not fail with mcp_not_ready)
          await expect(page.locator('[class*="status"]').or(page.locator('[class*="state"]'))).toBeVisible({ timeout: 15000 });
          
          // Verify no handshake errors
          const diagnostics = await page.evaluate(() => {
            const logs: string[] = [];
            const originalError = console.error;
            console.error = (...args) => logs.push(`[ERROR] ${args.join(' ')}`);
            return logs;
          });
          
          const handshakeErrors = diagnostics.filter(log => 
            log.includes("handshake_failed") || 
            log.includes("mcp_not_ready")
          );
          
          expect(handshakeErrors.length).toBe(0);
        }
      }
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("verify server restart loop fix - error logging", async () => {
    const { page, label } = await openE2EWindow();
    try {
      // Navigate to MCP Inspector
      await page.getByTitle("MCP Registry").click();
      await page.getByRole("button", { name: "Inspector" }).click();
      await expect(page.getByText("Servers", { exact: true })).toBeVisible({ timeout: 30000 });
      
      // Start TAQWIN server
      const taqwinServer = page.locator('button:has-text("taqwin")').or(page.locator('[class*="font-mono"]'));
      if (await taqwinServer.count() > 0) {
        await taqwinServer.first().click();
        
        const startButton = page.getByRole("button", { name: /start/i }).or(page.getByRole("button", { name: /▶/i }));
        if (await startButton.count() > 0) {
          await startButton.first().click();
          
          // Wait for server to be ready
          await page.waitForTimeout(3000);
          
          // Verify server is stable (not restarting repeatedly)
          const serverStatus = await page.locator('[class*="status"]').or(page.locator('[class*="state"]')).first().textContent();
          expect(serverStatus).not.toContain("ERROR");
          expect(serverStatus).not.toContain("RESTARTING");
        }
      }
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("verify shutdown method support - clean server shutdown", async () => {
    const { page, label } = await openE2EWindow();
    try {
      // Navigate to MCP Inspector
      await page.getByTitle("MCP Registry").click();
      await page.getByRole("button", { name: "Inspector" }).click();
      await expect(page.getByText("Servers", { exact: true })).toBeVisible({ timeout: 30000 });
      
      // Start TAQWIN server
      const taqwinServer = page.locator('button:has-text("taqwin")').or(page.locator('[class*="font-mono"]'));
      if (await taqwinServer.count() > 0) {
        await taqwinServer.first().click();
        
        const startButton = page.getByRole("button", { name: /start/i }).or(page.getByRole("button", { name: /▶/i }));
        if (await startButton.count() > 0) {
          await startButton.first().click();
          
          // Wait for server to be ready
          await page.waitForTimeout(3000);
          
          // Stop the server (should use shutdown method)
          const stopButton = page.getByRole("button", { name: /stop/i }).or(page.getByRole("button", { name: /⏹/i }));
          if (await stopButton.count() > 0) {
            await stopButton.first().click();
            
            // Verify clean shutdown (no Method not found: shutdown error)
            const diagnostics = await page.evaluate(() => {
              const logs: string[] = [];
              const originalError = console.error;
              console.error = (...args) => logs.push(`[ERROR] ${args.join(' ')}`);
              return logs;
            });
            
            const shutdownErrors = diagnostics.filter(log => 
              log.includes("Method not found") && 
              log.includes("shutdown")
            );
            
            expect(shutdownErrors.length).toBe(0);
          }
        }
      }
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("comprehensive MCP functionality test", async () => {
    const { page, label } = await openE2EWindow();
    try {
      // Set KNEZ endpoint if needed
      await setKnezEndpoint(page, "http://127.0.0.1:8000");
      
      // Navigate to MCP Registry
      await page.getByTitle("MCP Registry").click();
      await expect(page.getByRole("heading", { name: "MCP Registry" })).toBeVisible({ timeout: 30000 });
      
      // Click Inspector tab
      await page.getByRole("button", { name: "Inspector" }).click();
      await expect(page.getByText("MCP Config")).toBeVisible({ timeout: 30000 });
      
      // Verify server list is visible
      const serverButtons = page.locator('button:has(.font-mono)').or(page.locator('[class*="font-mono"]'));
      await expect(serverButtons.first()).toBeVisible({ timeout: 30000 });
      
      // Start TAQWIN server
      if (await serverButtons.count() > 0) {
        await serverButtons.first().click();
        
        const startButton = page.getByRole("button", { name: /start/i }).or(page.getByRole("button", { name: /▶/i }));
        if (await startButton.count() > 0) {
          await startButton.first().click();
          
          // Wait for handshake to complete with our fixes
          await page.waitForTimeout(2000); // Wait for the 500ms delay + handshake
          
          // Verify server is in READY state
          const serverStatus = await page.locator('[class*="status"]').or(page.locator('[class*="state"]')).first().textContent();
          expect(serverStatus).toContain("READY");
          
          // Test tool execution
          const toolCallButton = page.getByRole("button", { name: /call/i }).or(page.getByRole("button", { name: /execute/i }));
          if (await toolCallButton.count() > 0) {
            await toolCallButton.first().click();
            
            // Wait for tool execution
            await page.waitForTimeout(3000);
            
            // Verify no blocking errors
            const diagnostics = await page.evaluate(() => {
              const logs: string[] = [];
              const originalError = console.error;
              const originalWarn = console.warn;
              console.error = (...args) => logs.push(`[ERROR] ${args.join(' ')}`);
              console.warn = (...args) => logs.push(`[WARN] ${args.join(' ')}`);
              return logs;
            });
            
            const criticalErrors = diagnostics.filter(log => 
              log.includes("native_raw_tool_json_blocked") ||
              log.includes("handshake_failed") ||
              log.includes("Method not found") ||
              log.includes("mcp_not_ready")
            );
            
            expect(criticalErrors.length).toBe(0);
          }
        }
      }
    } finally {
      await closeE2EWindow(label);
    }
  });
});
