---
name: "ui-driver"
description: "Drive real clicks/inputs on the loaded app window for validation. Invoke when testing actual UI flows in dev/tauri."
tags: ui, testing, dom, tauri
version: "1.0.0"
---

# UI Driver

Principles:
- Interact with the same window as users; no separate headless runner
- Query deterministically; wait for visibility before acting
- Avoid flakiness; deterministic retries; bounded timeouts

API (conceptual):
- click(selector)
- type(selector, text)
- waitVisible(selector, timeoutMs)
- getText(selector)

Guidelines:
- Prefer data-testid attributes for selectors
- Use requestAnimationFrame delays for smoothness
- Always assert post-state (text content, class changes)

## Learnings
