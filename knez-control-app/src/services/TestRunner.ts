
import { chatService } from "./ChatService";
import { persistenceService } from "./PersistenceService";
import { sessionController } from "./SessionController";
import { sessionDatabase } from "./SessionDatabase";

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
    for (const test of this.results) {
      this.updateResult(test.id, { status: 'running', log: [] }); // Clear log on start
      try {
        await this.runTest(test.id);
        this.updateResult(test.id, { status: 'passed' });
      } catch (e: any) {
        this.updateResult(test.id, { status: 'failed', log: [String(e)] });
        
        // CP12-5: Map failures to Skills
        try {
          const { skillsRegistry } = await import('./SkillsRegistry');
          if (test.name.includes("Web Search")) {
             skillsRegistry.appendLearning('extraction-optimizer', `Failed test ${test.id}: ${e.message}`);
          } else if (test.name.includes("UI")) {
             skillsRegistry.appendLearning('ui-driver', `Failed test ${test.id}: ${e.message}`);
          }
        } catch {}
      }
    }
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
    cond: () => boolean,
    opts: { timeoutMs?: number; intervalMs?: number; timeoutMessage?: string } = {}
  ) {
    const timeoutMs = opts.timeoutMs ?? 8000;
    const intervalMs = opts.intervalMs ?? 250;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (cond()) return;
      await this.waitFor(intervalMs);
    }
    throw new Error(opts.timeoutMessage ?? "Timed out waiting for condition");
  }

  private async runTest(id: string) {
    // CP11: Use dedicated test sessions
    const testSessionId = `test-session-${id}-${Date.now()}`;
    sessionController.useSession(testSessionId);

    if (id === '1') {
       this.logStep(id, "Pinging system...");
       await this.waitFor(500);
       chatService.clear();
       await chatService.sendMessage("Ping");
       this.logStep(id, "Waiting for response...");
       await this.waitUntil(() => {
         const msgs = chatService.getMessages();
         const last = msgs[msgs.length - 1];
         return !!last && last.from === "knez" && !last.isPartial && last.text.trim().length > 0;
       }, { timeoutMessage: "No response from KNEZ (timed out waiting for assistant message)" });
       const msgs = chatService.getMessages();
       const last = msgs[msgs.length - 1];
       if (!last) throw new Error("No response from KNEZ (no messages)");
       if (last.from !== 'knez' || !last.text) throw new Error("No response from KNEZ");
       if (last.text.includes("Delivery Failure")) throw new Error(`KNEZ Error: ${last.text}`);
    }
    
    if (id === '2') {
       this.logStep(id, "Injecting Web Search query...");
       await this.waitFor(500);
       chatService.clear();
       const testUrl = "https://example.com";
       await chatService.sendMessage(`check ${testUrl}`);
       await this.waitUntil(() => {
         const msgs = chatService.getMessages();
         const last = msgs[msgs.length - 1];
         return !!last && last.from === "knez" && !last.isPartial;
       }, { timeoutMessage: "No web-search response from KNEZ (timed out)" });
       const msgs = chatService.getMessages();
       const last = msgs[msgs.length - 1];
       if (!last) throw new Error("No web-search response from KNEZ (no messages)");
       if (last.refusal) throw new Error("Refusal/Error in web search");
    }

    if (id === '3') {
       this.logStep(id, "Saving memory fact...");
       await chatService.sendMessage("My magic number is 42");
       await this.waitUntil(() => {
         const msgs = chatService.getMessages();
         const last = msgs[msgs.length - 1];
         return !!last && last.from === "knez" && !last.isPartial;
       }, { timeoutMessage: "Timed out waiting for memory fact response" });
       
       this.logStep(id, "Reloading session...");
       chatService.clear();
       await chatService.load(testSessionId);
       const msgs = chatService.getMessages();
       if (!msgs.find(m => m.text.includes("42"))) throw new Error("Persistence failed to reload message");
    }

    if (id === '4') {
       // UI Navigation Smoke (CP12-4)
       // This runs in the actual window context
       const { uiDriver } = await import('./UiDriverService');
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
       const { knezClient } = await import('./KnezClient');
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
       const { knezClient } = await import('./KnezClient');
       this.logStep(id, "Checking health...");
       await knezClient.health({ timeoutMs: 6000 });
       this.logStep(id, "Seeding events via TAQWIN adapter...");
       await knezClient.emitTaqwinEvent(testSessionId, "taqwin_replay_seed", { ok: true });
       this.logStep(id, "Fetching replay timeline...");
       const replay = await knezClient.getReplayTimeline(testSessionId);
       if (!replay) throw new Error("Replay is unavailable (missing endpoint or no data)");
       const phases = Array.isArray((replay as any).timeline) ? (replay as any).timeline : [];
       if (phases.length === 0) throw new Error("Replay returned no phases");
       const all = phases.flatMap((p: any) => p.events || []);
       const found = all.find((e: any) => e.event_name === "taqwin_replay_seed");
       if (!found) throw new Error("Replay missing seeded event");
    }

    if (id === '7') {
       this.logStep(id, "Sending message then switching sessions...");
       await chatService.sendMessage("CP12 switch delivery test");
       sessionController.createNewSession();
       await this.waitFor(100);

       const start = Date.now();
       while (Date.now() - start < 8000) {
         const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
         const last = msgs[msgs.length - 1];
         if (last && last.from === "knez" && last.deliveryStatus === "delivered" && !last.isPartial) return;
         await this.waitFor(150);
       }
       throw new Error("Timed out waiting for delivered response after session switch");
    }

    if (id === '8') {
       this.logStep(id, "Sending message then forking session...");
       await chatService.sendMessage("CP12 fork delivery test");
       await sessionController.forkSession(testSessionId);
       await this.waitFor(100);

       const start = Date.now();
       while (Date.now() - start < 8000) {
         const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
         const last = msgs[msgs.length - 1];
         if (last && last.from === "knez" && last.deliveryStatus === "delivered" && !last.isPartial) return;
         await this.waitFor(150);
       }
       throw new Error("Timed out waiting for delivered response after fork");
    }

    if (id === '9') {
       this.logStep(id, "Sending message then resuming session...");
       await chatService.sendMessage("CP12 resume delivery test");
       await sessionController.resumeSession(testSessionId);
       await this.waitFor(100);

       const start = Date.now();
       while (Date.now() - start < 8000) {
         const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
         const last = msgs[msgs.length - 1];
         if (last && last.from === "knez" && last.deliveryStatus === "delivered" && !last.isPartial) return;
         await this.waitFor(150);
       }
       throw new Error("Timed out waiting for delivered response after resume");
    }

    if (id === '10') {
       this.logStep(id, "Sending message that fails once then retries...");
       await chatService.sendMessage("[FAIL_ONCE] CP12 reconnect retry test");
       await this.waitFor(150);

       const start = Date.now();
       while (Date.now() - start < 12000) {
         const msgs = (await persistenceService.loadChat(testSessionId)) ?? [];
         const last = msgs[msgs.length - 1];
         const queue = await sessionDatabase.listOutgoing();
         const scoped = queue.filter((q) => q.sessionId === testSessionId);
         if (scoped.length === 0 && last && last.from === "knez" && last.deliveryStatus === "delivered" && !last.isPartial) return;
         await this.waitFor(250);
       }
       throw new Error("Timed out waiting for retry delivery to complete");
    }
  }

  private waitFor(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }
}

export const testRunner = new TestRunner();
