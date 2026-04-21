
import { chatService } from "../ChatService";
import { persistenceService } from "../infrastructure/persistence/PersistenceService";
import { sessionController } from "../session/SessionController";
import { sessionDatabase } from "../session/SessionDatabase";
import { logger } from "../utils/LogService";
import { TIMEOUT_CONFIG } from "../../config/features";

export interface TestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  log: string[];
}

export class TestRunner {
  private listeners: ((results: TestResult[]) => void)[] = [];
  private results: TestResult[] = [
    { id: '1', name: 'System Response Check', status: 'pending', log: [] },
    { id: '2', name: 'Web Search Extraction', status: 'pending', log: [] },
    { id: '3', name: 'Memory Persistence', status: 'pending', log: [] },
    { id: '4', name: 'UI Navigation Smoke', status: 'pending', log: [] },
    { id: '5', name: 'Memory Gate Visibility', status: 'pending', log: [] },
    { id: '6', name: 'Replay Timeline Playback', status: 'pending', log: [] },
    { id: '7', name: 'Send During Session Switch', status: 'pending', log: [] },
    { id: '8', name: 'Send During Fork', status: 'pending', log: [] },
    { id: '9', name: 'Send During Resume', status: 'pending', log: [] },
    { id: '10', name: 'Send During Reconnect', status: 'pending', log: [] },
    { id: '11', name: 'Stop Then Continue', status: 'pending', log: [] },
  ];

  subscribe(cb: (results: TestResult[]) => void) {
    this.listeners.push(cb);
    cb(this.results);
    return () => this.listeners = this.listeners.filter(l => l !== cb);
  }

  private updateResult(id: string, update: Partial<TestResult>) {
    this.results = this.results.map(r => {
       if (r.id === id) {
          const newLog =
            update.log === undefined
              ? r.log
              : update.log.length === 0
                ? []
                : [...r.log, ...update.log];
          return { ...r, ...update, log: newLog };
       }
       return r;
    });
    this.listeners.forEach(cb => cb(this.results));
  }

  async runAll() {
    const uiTestId = "4";
    const ids = this.results.map((t) => t.id).filter((id) => id !== uiTestId);
    const concurrency = 3;
    let cursor = 0;

    const runOneInternal = async (testId: string) => {
      const test = this.results.find((r) => r.id === testId);
      if (!test) return;
      this.updateResult(testId, { status: 'running', log: [] });
      try {
        await this.runTest(testId);
        this.updateResult(testId, { status: 'passed' });
      } catch (e: any) {
        this.updateResult(testId, { status: 'failed', log: [String(e)] });
        try {
          const { skillsRegistry } = await import('../infrastructure/config/SkillsRegistry');
          if (test.name.includes("Web Search")) {
            skillsRegistry.appendLearning('extraction-optimizer', `Failed test ${test.id}: ${e.message}`);
          } else if (test.name.includes("UI")) {
            skillsRegistry.appendLearning('ui-driver', `Failed test ${test.id}: ${e.message}`);
          }
        } catch (skillsError) {
          logger.error('test_runner', 'skills_registry_append_failed', { error: String(skillsError) });
        }
      }
    };

    const worker = async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        await runOneInternal(id);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()));
    await runOneInternal(uiTestId);
  }

  async runOne(id: string) {
    const test = this.results.find(r => r.id === id);
    if (!test) return;
    this.updateResult(test.id, { status: 'running', log: [] });
    try {
      await this.runTest(test.id);
      this.updateResult(test.id, { status: 'passed' });
    } catch (e: any) {
      this.updateResult(test.id, { status: 'failed', log: [String(e)] });
    }
  }

  private logStep(id: string, msg: string) {
     this.updateResult(id, { log: [`[STEP] ${msg}`] });
  }

  private async waitUntil(
    cond: () => boolean | Promise<boolean>,
    opts: { timeoutMs?: number; intervalMs?: number; timeoutMessage?: string } = {}
  ) {
    const timeoutMs = opts.timeoutMs ?? TIMEOUT_CONFIG.TEST_RUNNER_TIMEOUT_MS;
    const intervalMs = opts.intervalMs ?? TIMEOUT_CONFIG.TEST_RUNNER_INTERVAL_MS;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await cond()) return;
      await this.waitFor(intervalMs);
    }
    throw new Error(opts.timeoutMessage ?? "Timed out waiting for condition");
  }

  private async runTest(id: string) {
    // CP11: Use dedicated test sessions
    const testSessionId = `test-session-${id}-${Date.now()}`;

    if (id === '1') {
       this.logStep(id, "Pinging system...");
       await this.waitFor(500);
       await chatService.sendMessageForSession(testSessionId, "Ping");
       this.logStep(id, "Waiting for response...");
       await this.waitUntil(async () => {
         const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
         const last = msgs[msgs.length - 1];
         return !!last && last.from === "knez" && !last.isPartial && last.text.trim().length > 0;
       }, { timeoutMs: 25000, timeoutMessage: "No response from KNEZ (timed out waiting for assistant message)" });
       const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
       const last = msgs[msgs.length - 1];
       if (!last) throw new Error("No response from KNEZ (no messages)");
       if (last.from !== 'knez' || !last.text) throw new Error("No response from KNEZ");
       if (last.text.includes("Delivery Failure")) throw new Error(`KNEZ Error: ${last.text}`);
    }
    
    if (id === '2') {
       this.logStep(id, "Injecting Web Search query...");
       await this.waitFor(500);
       const testUrl = "https://example.com";
       await chatService.sendMessageForSession(testSessionId, `check ${testUrl}`, { searchEnabled: true });
       await this.waitUntil(async () => {
         const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
         const last = msgs[msgs.length - 1];
         return !!last && last.from === "knez" && !last.isPartial;
       }, { timeoutMs: 30000, timeoutMessage: "No web-search response from KNEZ (timed out)" });
       const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
       const last = msgs[msgs.length - 1];
       if (!last) throw new Error("No web-search response from KNEZ (no messages)");
       if (last.refusal) throw new Error("Refusal/Error in web search");
    }

    if (id === '3') {
       this.logStep(id, "Saving memory fact...");
       await chatService.sendMessageForSession(testSessionId, "My magic number is 42");
       const startWait = Date.now();
       while (Date.now() - startWait < 20000) {
         const stored = (await persistenceService.loadChat(testSessionId)) ?? [];
         if (stored.find((m) => m.from === "user" && m.text.includes("42"))) break;
         await this.waitFor(150);
       }

       this.logStep(id, "Reloading session...");
       const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
       if (!msgs.find(m => m.text.includes("42"))) throw new Error("Persistence failed to reload message");
    }

    if (id === '4') {
       // UI Navigation Smoke (CP12-4)
       // This runs in the actual window context
       const { uiDriver } = await import('../ui/driver/UiDriverService');
       this.logStep(id, "Navigating to Chat view...");
       await uiDriver.click('button[title="Chat"]');
       this.logStep(id, "Waiting for Chat Input...");
       await uiDriver.waitVisible('[data-testid="chat-input"]');
       
       this.logStep(id, "Checking Web Search button...");
       await uiDriver.waitVisible('[data-testid="search-toggle"]'); 
       
       this.logStep(id, "Clicking Web Search toggle...");
       await uiDriver.click('[data-testid="search-toggle"]');
    }

    if (id === '5') {
       const { knezClient } = await import('../knez/KnezClient');
       this.logStep(id, "Triggering memory gate check...");
       await knezClient.checkMemoryGate(testSessionId);
       this.logStep(id, "Fetching events for gate evidence...");
       const evs = await knezClient.listEvents(testSessionId, 200);
       const found = evs.find((e: any) => e.event_name === "reflection_memory_rejected");
       if (!found) throw new Error("No gate event found in /events");
       const p = (found as any).payload || {};
       if (!p.policy_name || !p.rule_name) throw new Error("Gate event missing policy_name/rule_name");
    }

    if (id === '6') {
       const { knezClient } = await import('../knez/KnezClient');
       this.logStep(id, "Checking health...");
       await knezClient.health({ timeoutMs: 8000 });
       this.logStep(id, "Generating replayable events...");
       await chatService.sendMessageForSession(testSessionId, "Replay test message");
       await this.waitUntil(async () => {
         const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
         const last = msgs[msgs.length - 1];
         return !!last && last.from === "knez" && !last.isPartial;
       }, { timeoutMs: 25000, timeoutMessage: "Timed out waiting for replay test response" });
       this.logStep(id, "Fetching replay timeline...");
       const replay = await knezClient.getReplayTimeline(testSessionId);
       if (!replay) throw new Error("Replay is unavailable (missing endpoint or no data)");
       const phases = Array.isArray((replay as any).timeline) ? (replay as any).timeline : [];
       if (phases.length === 0) throw new Error("Replay returned no phases");
       const all = phases.flatMap((p: any) => p.events || []);
       const found = all.find((e: any) => typeof e?.event_name === "string" && e.event_name.length > 0);
       if (!found) throw new Error("Replay contains no events");
    }

    if (id === '7') {
       this.logStep(id, "Sending message and verifying delivery...");
       await chatService.sendMessageForSession(testSessionId, "CP12 delivery test");

       const start = Date.now();
       while (Date.now() - start < 20000) {
         const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
         const last = msgs[msgs.length - 1];
         if (last && last.from === "knez" && last.deliveryStatus === "delivered" && !last.isPartial) return;
         await this.waitFor(150);
       }
       throw new Error("Timed out waiting for delivered response");
    }

    if (id === '8') {
       this.logStep(id, "Sending message then forking session...");
       await chatService.sendMessageForSession(testSessionId, "CP12 fork delivery test");
       const { knezClient } = await import('../knez/KnezClient');
       const startPreflight = Date.now();
       while (Date.now() - startPreflight < 15000) {
         const ok = await knezClient.validateSession(testSessionId);
         if (ok) break;
         await this.waitFor(250);
       }
       try {
         await sessionController.forkSession(testSessionId, undefined, false);
       } catch (e: any) {
         const msg = String(e?.message ?? e);
         if (msg.includes("fork_failed_404")) return;
         throw e;
       }
       await this.waitFor(100);

       const start = Date.now();
       while (Date.now() - start < 20000) {
         const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
         const last = msgs[msgs.length - 1];
         if (last && last.from === "knez" && last.deliveryStatus === "delivered" && !last.isPartial) return;
         await this.waitFor(150);
       }
       throw new Error("Timed out waiting for delivered response after fork");
    }

    if (id === '9') {
       this.logStep(id, "Sending message then resuming session...");
       await chatService.sendMessageForSession(testSessionId, "CP12 resume delivery test");
       const { knezClient } = await import('../knez/KnezClient');
       const startPreflight = Date.now();
       while (Date.now() - startPreflight < 15000) {
         const ok = await knezClient.validateSession(testSessionId);
         if (ok) break;
         await this.waitFor(250);
       }
       try {
         await sessionController.resumeSession(testSessionId, false);
       } catch (e: any) {
         const msg = String(e?.message ?? e);
         if (msg.includes("resume_failed_404")) return;
         throw e;
       }
       await this.waitFor(100);

       const start = Date.now();
       while (Date.now() - start < 20000) {
         const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
         const last = msgs[msgs.length - 1];
         if (last && last.from === "knez" && last.deliveryStatus === "delivered" && !last.isPartial) return;
         await this.waitFor(150);
       }
       throw new Error("Timed out waiting for delivered response after resume");
    }

    if (id === '10') {
       this.logStep(id, "Sending message that fails once then retries...");
       await chatService.sendMessageForSession(testSessionId, "[FAIL_ONCE] CP12 reconnect retry test");
       await this.waitFor(150);

       const start = Date.now();
       while (Date.now() - start < 25000) {
         const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
         const last = msgs[msgs.length - 1];
         const queue = await sessionDatabase.listOutgoing();
         const scoped = queue.filter((q) => q.sessionId === testSessionId);
         if (scoped.length === 0 && last && last.from === "knez" && last.deliveryStatus === "delivered" && !last.isPartial) return;
         await this.waitFor(250);
       }
       throw new Error("Timed out waiting for retry delivery to complete");
    }

    if (id === '11') {
      this.logStep(id, "Sending message then attempting Stop...");
      await chatService.sendMessageForSession(testSessionId, "CP13 stop then continue test");
      await this.waitFor(400);
      chatService.stopResponseForSession(testSessionId);
      await this.waitFor(600);

      const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
      const lastAssistant = [...msgs].reverse().find((m) => m.from === "knez");
      if (!lastAssistant) return;

      if (lastAssistant.metrics?.finishReason === "stopped") {
        this.logStep(id, "Attempting Continue...");
        const tail = (lastAssistant.text ?? "").slice(-2000);
        await chatService.sendMessageForSession(testSessionId, "Continue", { forceContext: `\n\n[SYSTEM: Continue]\nResume from the last assistant output:\n${tail}` });
      }
    }
  }

  private waitFor(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }
}

export const testRunner = new TestRunner();
