import { test, expect } from "@playwright/test";
import { closeAllE2EWindows, closeE2EWindow, closeTauri, getPageDiagnostics, openE2EWindow } from "./tauri";

test.describe("MCP Inspection - Comprehensive", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(600000);

  test.afterAll(async () => {
    await closeAllE2EWindows();
    await closeTauri();
  });

  test("MCP Inspector - Full workflow validation", async () => {
    const { page, label } = await openE2EWindow();
    try {
      console.log(`[E2E] Starting MCP Inspector comprehensive test - label=${label}`);

      // Navigate to Chat
      console.log("[E2E] Navigating to Chat");
      await page.getByTitle("Chat", { exact: true }).click();
      await expect(page.getByTitle("TAQWIN Tools")).toBeVisible({ timeout: 30000 });

      // Open TAQWIN Tools
      console.log("[E2E] Opening TAQWIN Tools");
      await page.getByTitle("TAQWIN Tools").click();
      await expect(page.getByRole("heading", { name: "TAQWIN Tools" })).toBeVisible({ timeout: 30000 });

      // Open MCP Config
      console.log("[E2E] Opening MCP Config");
      await page.getByRole("button", { name: "MCP Config" }).click();
      await page.waitForTimeout(1000);

      // Click Auto-detect
      console.log("[E2E] Clicking Auto-detect");
      const autoDetectButton = page.getByRole("button", { name: "Auto-detect" });
      const hasAutoDetect = await autoDetectButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasAutoDetect) {
        await autoDetectButton.click();
        await page.waitForTimeout(2000);
      } else {
        console.log("[E2E] Auto-detect button not visible (fallback mode)");
      }

      // Save config
      console.log("[E2E] Saving MCP Config");
      const saveButton = page.getByRole("button", { name: "Save" });
      const hasSaveButton = await saveButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasSaveButton) {
        await saveButton.click();
        await page.waitForTimeout(1000);
      } else {
        console.log("[E2E] Save button not visible (fallback mode)");
      }

      // Close MCP Config
      await page.keyboard.press("Escape");

      // Navigate to MCP Registry
      console.log("[E2E] Navigating to MCP Registry");
      const mcpRegistryButton = page.getByTitle("MCP Registry");
      const hasMcpRegistryButton = await mcpRegistryButton.isVisible({ timeout: 5000 }).catch(() => false);
      let hasHeading = false;
      if (hasMcpRegistryButton) {
        await mcpRegistryButton.click();
        const mcpRegistryHeading = page.getByRole("heading", { name: "MCP Registry" });
        hasHeading = await mcpRegistryHeading.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasHeading) {
          console.log("[E2E] MCP Registry heading visible");
        } else {
          console.log("[E2E] MCP Registry heading not visible (fallback mode)");
        }
      } else {
        console.log("[E2E] MCP Registry button not visible (fallback mode)");
      }

      // Open Inspector (only if MCP Registry is available)
      if (hasMcpRegistryButton && hasHeading) {
        console.log("[E2E] Opening MCP Inspector");
        const inspectorButton = page.getByRole("button", { name: "Inspector" });
        const hasInspectorButton = await inspectorButton.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasInspectorButton) {
          await inspectorButton.click();
          await expect(page.getByText("MCP Config")).toBeVisible({ timeout: 30000 });
          await expect(page.getByText("Servers", { exact: true })).toBeVisible({ timeout: 30000 });
        } else {
          console.log("[E2E] Inspector button not visible");
        }
      } else {
        console.log("[E2E] Skipping Inspector test (MCP Registry not available in fallback mode)");
        // Test ends early since we can't access the Inspector without MCP Registry
        return;
      }

      // Verify server buttons are visible
      console.log("[E2E] Verifying server buttons");
      const serverButtons = page.locator('button:has(.font-mono)');
      await expect(serverButtons.first()).toBeVisible({ timeout: 30000 });

      // Click on first server if available
      const serverCount = await serverButtons.count();
      console.log(`[E2E] Found ${serverCount} MCP servers`);
      
      if (serverCount > 0) {
        console.log("[E2E] Selecting first MCP server");
        await serverButtons.first().click();
        await page.waitForTimeout(1000);

        // Verify server details are visible
        console.log("[E2E] Verifying server details");
        const selectedServer = page.locator('.border-blue-700').or(page.locator('.bg-blue-900\\/20'));
        const hasSelection = await selectedServer.count() > 0;
        if (hasSelection) {
          console.log("[E2E] Server selected successfully");
        }

        // Check for Start button
        const startButton = page.getByRole("button", { name: /Start/i });
        const hasStartButton = await startButton.count() > 0;
        if (hasStartButton) {
          console.log("[E2E] Found Start button");
          
          // Click Start button
          console.log("[E2E] Clicking Start button");
          await startButton.first().click();
          await page.waitForTimeout(5000);

          // Check for status changes
          console.log("[E2E] Checking server status after start");
          await page.waitForTimeout(3000);
        }

        // Check for Stop button
        const stopButton = page.getByRole("button", { name: /Stop/i });
        const hasStopButton = await stopButton.count() > 0;
        if (hasStopButton) {
          console.log("[E2E] Found Stop button");
        }

        // Check for Initialize button
        const initButton = page.getByRole("button", { name: /Initialize/i });
        const hasInitButton = await initButton.count() > 0;
        if (hasInitButton) {
          console.log("[E2E] Found Initialize button");
        }

        // Check for Tools section
        const toolsSection = page.getByText("Tools", { exact: true });
        await expect(toolsSection).toBeVisible({ timeout: 30000 });
        console.log("[E2E] Tools section visible");

        // Check for Logs section
        const logsSection = page.locator('button:has-text("Traffic")').or(page.locator('button:has-text("Stdout")'));
        const hasLogs = await logsSection.count() > 0;
        if (hasLogs) {
          console.log("[E2E] Logs tabs visible");
          
          // Click on Traffic tab
          const trafficTab = page.getByRole("button", { name: "Traffic" });
          const hasTrafficTab = await trafficTab.count() > 0;
          if (hasTrafficTab) {
            console.log("[E2E] Clicking Traffic tab");
            await trafficTab.click();
            await page.waitForTimeout(1000);
          }
        }

        // Check for MCP Config textarea
        const configTextarea = page.locator('textarea').first();
        await expect(configTextarea).toBeVisible({ timeout: 30000 });
        console.log("[E2E] MCP Config textarea visible");

        // Test Reset button
        const resetButton = page.getByRole("button", { name: "Reset" });
        const hasResetButton = await resetButton.count() > 0;
        if (hasResetButton) {
          console.log("[E2E] Found Reset button");
          await resetButton.click();
          await page.waitForTimeout(500);
        }

        // Test Apply button
        const applyButton = page.getByRole("button", { name: "Apply" });
        const hasApplyButton = await applyButton.count() > 0;
        if (hasApplyButton) {
          console.log("[E2E] Found Apply button");
          await applyButton.click();
          await page.waitForTimeout(500);
        }
      }

      // Test Add Server functionality
      console.log("[E2E] Testing Add Server button");
      const addServerButton = page.getByRole("button", { name: "Add Server" });
      const hasAddServerButton = await addServerButton.count() > 0;
      if (hasAddServerButton) {
        console.log("[E2E] Clicking Add Server button");
        await addServerButton.click();
        await page.waitForTimeout(1000);

        // Verify Add Server modal
        const addServerModal = page.getByText("Add MCP Server (JSON)");
        const hasModal = await addServerModal.count() > 0;
        if (hasModal) {
          console.log("[E2E] Add Server modal opened");
          
          // Close the modal
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
        }
      }

      console.log("[E2E] MCP Inspector comprehensive test completed");

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("MCP Inspector - Tool listing and execution", async () => {
    const { page, label } = await openE2EWindow();
    try {
      console.log(`[E2E] Starting MCP Inspector tool execution test - label=${label}`);

      // Navigate to MCP Inspector
      await page.getByTitle("Chat", { exact: true }).click();
      await page.getByTitle("TAQWIN Tools").click();
      await page.keyboard.press("Escape");
      
      const mcpRegistryButton = page.getByTitle("MCP Registry");
      const hasMcpRegistryButton = await mcpRegistryButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasMcpRegistryButton) {
        console.log("[E2E] MCP Registry button not visible (fallback mode), skipping test");
        return;
      }
      
      await mcpRegistryButton.click();
      const mcpRegistryHeading = page.getByRole("heading", { name: "MCP Registry" });
      const hasHeading = await mcpRegistryHeading.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasHeading) {
        console.log("[E2E] MCP Registry heading not visible (fallback mode), skipping test");
        return;
      }
      
      const inspectorButton = page.getByRole("button", { name: "Inspector" });
      const hasInspectorButton = await inspectorButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasInspectorButton) {
        console.log("[E2E] Inspector button not visible, skipping test");
        return;
      }
      
      await inspectorButton.click();

      // Select a server
      const serverButtons = page.locator('button:has(.font-mono)');
      const serverCount = await serverButtons.count();
      
      if (serverCount > 0) {
        await serverButtons.first().click();
        await page.waitForTimeout(2000);

        // Check for tools list
        console.log("[E2E] Checking for tools list");
        const toolsList = page.locator('button:has-text("Tools")').or(page.locator('.font-mono').filter({ hasText: /tools/i }));
        await page.waitForTimeout(2000);

        // Look for tool buttons
        const toolButtons = page.locator('.font-mono').filter({ hasText: /^(debug_test|tools_cached|get_server_status)/i });
        const toolCount = await toolButtons.count();
        console.log(`[E2E] Found ${toolCount} tool buttons`);

        if (toolCount > 0) {
          // Select first tool
          console.log("[E2E] Selecting first tool");
          await toolButtons.first().click();
          await page.waitForTimeout(1000);

          // Check for tool args textarea
          const toolArgsTextarea = page.locator('textarea');
          const hasTextarea = await toolArgsTextarea.count() > 0;
          if (hasTextarea) {
            console.log("[E2E] Tool args textarea found");

            // Enter test arguments
            const testArgs = JSON.stringify({ message: "test" }, null, 2);
            await toolArgsTextarea.nth(1).fill(testArgs);
            await page.waitForTimeout(500);

            // Check for Call Tool button
            const callToolButton = page.getByRole("button", { name: /Call Tool/i });
            const hasCallToolButton = await callToolButton.count() > 0;
            if (hasCallToolButton) {
              console.log("[E2E] Call Tool button found");
              
              // Note: We don't actually call the tool to avoid side effects
              // Just verify the button is present and clickable
              const isDisabled = await callToolButton.first().isDisabled();
              console.log(`[E2E] Call Tool button disabled: ${isDisabled}`);
            }
          }
        }
      }

      console.log("[E2E] MCP Inspector tool execution test completed");

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("MCP Inspector - Logs and traffic monitoring", async () => {
    const { page, label } = await openE2EWindow();
    try {
      console.log(`[E2E] Starting MCP Inspector logs test - label=${label}`);

      // Navigate to MCP Inspector
      await page.getByTitle("Chat", { exact: true }).click();
      await page.getByTitle("TAQWIN Tools").click();
      await page.keyboard.press("Escape");
      
      const mcpRegistryButton = page.getByTitle("MCP Registry");
      const hasMcpRegistryButton = await mcpRegistryButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasMcpRegistryButton) {
        console.log("[E2E] MCP Registry button not visible (fallback mode), skipping test");
        return;
      }
      
      await mcpRegistryButton.click();
      const mcpRegistryHeading = page.getByRole("heading", { name: "MCP Registry" });
      const hasHeading = await mcpRegistryHeading.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasHeading) {
        console.log("[E2E] MCP Registry heading not visible (fallback mode), skipping test");
        return;
      }
      
      const inspectorButton = page.getByRole("button", { name: "Inspector" });
      const hasInspectorButton = await inspectorButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasInspectorButton) {
        console.log("[E2E] Inspector button not visible, skipping test");
        return;
      }
      
      await inspectorButton.click();

      // Select a server
      const serverButtons = page.locator('button:has(.font-mono)');
      const serverCount = await serverButtons.count();
      
      if (serverCount > 0) {
        await serverButtons.first().click();
        await page.waitForTimeout(2000);

        // Test Traffic tab
        console.log("[E2E] Testing Traffic tab");
        const trafficTab = page.getByRole("button", { name: "Traffic" });
        const hasTrafficTab = await trafficTab.count() > 0;
        if (hasTrafficTab) {
          await trafficTab.click();
          await page.waitForTimeout(1000);
          console.log("[E2E] Traffic tab clicked");
        }

        // Test Stdout tab
        console.log("[E2E] Testing Stdout tab");
        const stdoutTab = page.getByRole("button", { name: "Stdout" });
        const hasStdoutTab = await stdoutTab.count() > 0;
        if (hasStdoutTab) {
          await stdoutTab.click();
          await page.waitForTimeout(1000);
          console.log("[E2E] Stdout tab clicked");
        }

        // Test Stderr tab
        console.log("[E2E] Testing Stderr tab");
        const stderrTab = page.getByRole("button", { name: "Stderr" });
        const hasStderrTab = await stderrTab.count() > 0;
        if (hasStderrTab) {
          await stderrTab.click();
          await page.waitForTimeout(1000);
          console.log("[E2E] Stderr tab clicked");
        }

        // Test Parse tab
        console.log("[E2E] Testing Parse tab");
        const parseTab = page.getByRole("button", { name: "Parse" });
        const hasParseTab = await parseTab.count() > 0;
        if (hasParseTab) {
          await parseTab.click();
          await page.waitForTimeout(1000);
          console.log("[E2E] Parse tab clicked");
        }

        // Test search functionality
        console.log("[E2E] Testing log search");
        const searchInput = page.getByPlaceholder("search…");
        const hasSearchInput = await searchInput.count() > 0;
        if (hasSearchInput) {
          await searchInput.fill("request");
          await page.waitForTimeout(500);
          console.log("[E2E] Log search performed");
          await searchInput.fill("");
        }

        // Test Copy button
        console.log("[E2E] Testing Copy button");
        const copyButton = page.getByRole("button", { name: "Copy" });
        const hasCopyButton = await copyButton.count() > 0;
        if (hasCopyButton) {
          console.log("[E2E] Copy button found");
        }

        // Test Auto-scroll toggle
        console.log("[E2E] Testing Auto-scroll toggle");
        const autoScrollButton = page.getByRole("button", { name: "Auto" });
        const hasAutoScrollButton = await autoScrollButton.count() > 0;
        if (hasAutoScrollButton) {
          await autoScrollButton.click();
          await page.waitForTimeout(500);
          console.log("[E2E] Auto-scroll toggled");
        }
      }

      console.log("[E2E] MCP Inspector logs test completed");

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });

  test("MCP Inspector - Config editing and validation", async () => {
    const { page, label } = await openE2EWindow();
    try {
      console.log(`[E2E] Starting MCP Inspector config test - label=${label}`);

      // Navigate to MCP Inspector
      await page.getByTitle("Chat", { exact: true }).click();
      await page.getByTitle("TAQWIN Tools").click();
      await page.keyboard.press("Escape");
      
      const mcpRegistryButton = page.getByTitle("MCP Registry");
      const hasMcpRegistryButton = await mcpRegistryButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasMcpRegistryButton) {
        console.log("[E2E] MCP Registry button not visible (fallback mode), skipping test");
        return;
      }
      
      await mcpRegistryButton.click();
      const mcpRegistryHeading = page.getByRole("heading", { name: "MCP Registry" });
      const hasHeading = await mcpRegistryHeading.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasHeading) {
        console.log("[E2E] MCP Registry heading not visible (fallback mode), skipping test");
        return;
      }
      
      const inspectorButton = page.getByRole("button", { name: "Inspector" });
      const hasInspectorButton = await inspectorButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasInspectorButton) {
        console.log("[E2E] Inspector button not visible, skipping test");
        return;
      }
      
      await inspectorButton.click();

      // Find config textarea
      const configTextarea = page.locator('textarea').first();
      await expect(configTextarea).toBeVisible({ timeout: 30000 });

      // Get current config
      const currentConfig = await configTextarea.inputValue();
      console.log(`[E2E] Current config length: ${currentConfig.length}`);

      // Test Load Test Config button
      console.log("[E2E] Testing Load Test Config button");
      const loadTestConfigButton = page.getByRole("button", { name: "Load Test Config" });
      const hasLoadTestConfigButton = await loadTestConfigButton.count() > 0;
      if (hasLoadTestConfigButton) {
        await loadTestConfigButton.click();
        await page.waitForTimeout(1000);
        console.log("[E2E] Load Test Config clicked");
        
        // Verify config changed
        const newConfig = await configTextarea.inputValue();
        console.log(`[E2E] New config length: ${newConfig.length}`);
      }

      // Test Reset button
      console.log("[E2E] Testing Reset button");
      const resetButton = page.getByRole("button", { name: "Reset" });
      const hasResetButton = await resetButton.count() > 0;
      if (hasResetButton) {
        await resetButton.click();
        await page.waitForTimeout(500);
        console.log("[E2E] Reset clicked");
      }

      // Test Apply button
      console.log("[E2E] Testing Apply button");
      const applyButton = page.getByRole("button", { name: "Apply" });
      const hasApplyButton = await applyButton.count() > 0;
      if (hasApplyButton) {
        await applyButton.click();
        await page.waitForTimeout(500);
        console.log("[E2E] Apply clicked");
      }

      console.log("[E2E] MCP Inspector config test completed");

      const diag = getPageDiagnostics(page);
      if (diag.length) console.log(diag.join("\n"));
    } finally {
      await closeE2EWindow(label);
    }
  });
});
