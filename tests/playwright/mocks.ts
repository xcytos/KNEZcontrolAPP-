import { Page } from '@playwright/test';

export async function mockKnezBackend(page: Page) {
  // Mock Sessions
  await page.route('**/sessions', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ session_id: "sess-mock-001" })
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/sessions/*/resume', async route => {
     await route.fulfill({ status: 200, body: "{}" });
  });

  await page.route('**/sessions/*/resume_snapshot', async route => {
     await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
           snapshot_id: "snap-001",
           session_id: "sess-mock-001",
           created_at: new Date().toISOString(),
           high_level_task_state: "Idle",
           accepted_facts: [],
           constraints: []
        })
     });
  });

  await page.route('**/sessions/*/fork', async route => {
     await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ session_id: "sess-mock-fork-002" })
     });
  });

  // Mock Health
  await page.route('**/health', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: "ok",
        version: "0.1.0",
        backends: [
          { model_id: "gpt-4", status: "ok", latency_ms: 120, failure_rate: 0.0, rolling_score: 1.0 }
        ]
      })
    });
  });

  // Mock Cognitive State
  await page.route('**/state/overview', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        focus_level: "Deep Work",
        stability_score: 98,
        active_contexts: 3
      })
    });
  });

  // Mock Events
  await page.route('**/events**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  // Mock Chat Completions
  await page.route('**/v1/chat/completions', async route => {
    // Stream response
    const responseBody = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" there!"}}]}\n\n',
      'data: [DONE]\n\n'
    ].join('');

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: responseBody
    });
  });
  
  // Mock Perception
  await page.route('**/perception/snapshot', async route => {
     await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
           timestamp: Date.now() / 1000,
           image_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
           width: 100,
           height: 100,
           source: "mock_test"
        })
     });
  });

  await page.route('**/perception/active_window', async route => {
     await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
           title: "Playwright Test Runner",
           bounds: { left:0, top:0, width:1920, height:1080 }
        })
     });
  });

  // Mock MCP Registry
  await page.route('**/mcp/registry', async route => {
     await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
           items: [
              { id: "filesystem-local", provider: "local", status: "enabled", capabilities: ["read", "write"] },
              { id: "fetch-web", provider: "http", status: "disabled", capabilities: ["fetch"] }
           ]
        })
     });
  });
}
