
import { chatService } from "./ChatService";
// import { persistenceService } from "./PersistenceService";

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
  ];

  subscribe(cb: (results: TestResult[]) => void) {
    this.listeners.push(cb);
    cb(this.results);
    return () => this.listeners = this.listeners.filter(l => l !== cb);
  }

  private updateResult(id: string, update: Partial<TestResult>) {
    this.results = this.results.map(r => {
       if (r.id === id) {
          // Append log if present, don't overwrite array unless intended
          const newLog = update.log ? [...r.log, ...update.log] : r.log;
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

  private logStep(id: string, msg: string) {
     this.updateResult(id, { log: [`[STEP] ${msg}`] });
  }

  private async runTest(id: string) {
    // CP11: Use dedicated test sessions
    const testSessionId = `test-session-${id}-${Date.now()}`;
    chatService.setSessionId(testSessionId);

    if (id === '1') {
       this.logStep(id, "Pinging system...");
       await this.waitFor(500);
       chatService.clear();
       await chatService.sendMessage("Ping");
       this.logStep(id, "Waiting for response...");
       await this.waitFor(2000); 
       const msgs = chatService.getMessages();
       const last = msgs[msgs.length - 1];
       if (last.from !== 'knez' || !last.text) throw new Error("No response from KNEZ");
       if (last.text.includes("Delivery Failure")) throw new Error(`KNEZ Error: ${last.text}`);
    }
    
    if (id === '2') {
       this.logStep(id, "Injecting Web Search query...");
       await this.waitFor(500);
       chatService.clear();
       const testUrl = "https://example.com";
       await chatService.sendMessage(`check ${testUrl}`);
       await this.waitFor(3000);
       const msgs = chatService.getMessages();
       const last = msgs[msgs.length - 1];
       if (last.refusal) throw new Error("Refusal/Error in web search");
    }

    if (id === '3') {
       this.logStep(id, "Saving memory fact...");
       await chatService.sendMessage("My magic number is 42");
       await this.waitFor(2000);
       
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
       this.logStep(id, "Waiting for Chat Input...");
       await uiDriver.waitVisible('input[placeholder*="Type a message"]');
       
       this.logStep(id, "Checking Web Search button...");
       // Use our custom selector syntax handled by UiDriverService
       // Note: The button text is "Web Search: ON" or "Web Search: OFF"
       await uiDriver.waitVisible('button:has-text("Web Search")'); 
       
       this.logStep(id, "Clicking Web Search toggle...");
       await uiDriver.click('button:has-text("Web Search")');
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
       this.logStep(id, "Seeding events via TAQWIN adapter...");
       await knezClient.emitTaqwinEvent(testSessionId, "taqwin_replay_seed", { ok: true });
       this.logStep(id, "Fetching replay timeline...");
       const replay = await knezClient.getReplayTimeline(testSessionId);
       const phases = Array.isArray((replay as any).timeline) ? (replay as any).timeline : [];
       if (phases.length === 0) throw new Error("Replay returned no phases");
       const all = phases.flatMap((p: any) => p.events || []);
       const found = all.find((e: any) => e.event_name === "taqwin_replay_seed");
       if (!found) throw new Error("Replay missing seeded event");
    }
  }

  private waitFor(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }
}

export const testRunner = new TestRunner();
