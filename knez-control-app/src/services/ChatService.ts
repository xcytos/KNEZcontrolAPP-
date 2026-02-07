
import { knezClient } from "./KnezClient";
import { extractionService } from "./ExtractionService";
import { persistenceService } from "./PersistenceService";
import { ChatMessage } from "../domain/DataContracts";
import { asErrorMessage } from "../domain/Errors";
import { observe } from "../utils/observer";
import { sessionDatabase } from "./SessionDatabase";
import { sessionController } from "./SessionController";

export interface ChatState {
  messages: ChatMessage[];
  sending: boolean;
  activeTools: { search: boolean };
}

export type StateListener = (state: ChatState) => void;

class ChatService {
  private listeners: StateListener[] = [];
  private state: ChatState = {
    messages: [],
    sending: false,
    activeTools: { search: false }
  };
  private sessionId: string;
  private queueFlushInFlight = false;

  constructor() {
    this.sessionId = sessionController.getSessionId();
    void this.load(this.sessionId);
    sessionController.subscribe(({ sessionId }) => {
      this.sessionId = sessionId;
      void this.load(sessionId);
      void this.flushOutgoingQueue();
    });
    window.setInterval(() => {
      void this.flushOutgoingQueue();
    }, 1500);
  }

  subscribe(listener: StateListener) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
  }

  async load(sessionId: string) {
    const loaded = await persistenceService.loadChat(sessionId);
    if (loaded && loaded.length > 0) {
      this.state.messages = loaded;
    } else {
      this.state.messages = [];
    }
    this.notify();
  }

  setActiveTools(tools: { search: boolean }) {
    this.state.activeTools = tools;
    this.notify();
  }

  async sendMessage(text: string, forceContext?: string): Promise<void> {
    if (!text.trim()) return;

    const now = new Date().toISOString();
    const userId = newMessageId();
    const assistantId = `${userId}-assistant`;

    const userMsg: ChatMessage = {
      id: userId,
      sessionId: this.sessionId,
      from: "user",
      text: text,
      createdAt: now,
      deliveryStatus: "pending",
      correlationId: userId
    };

    const assistantMsg: ChatMessage = {
      id: assistantId,
      sessionId: this.sessionId,
      from: "knez",
      text: "",
      createdAt: now,
      isPartial: true,
      metrics: { totalTokens: 0 },
      deliveryStatus: "pending",
      replyToMessageId: userId,
      correlationId: userId
    };

    this.state.messages = [...this.state.messages, userMsg, assistantMsg];
    this.notify();
    observe("chat_send_attempt", { sessionId: this.sessionId, message: text });
    await this.ensureSessionExists(this.sessionId);
    await sessionDatabase.saveMessages(this.sessionId, [userMsg, assistantMsg]);
    await sessionDatabase.enqueueOutgoing({
      id: userId,
      sessionId: this.sessionId,
      text,
      searchEnabled: this.state.activeTools.search,
      createdAt: now
    });
    void this.flushOutgoingQueue(forceContext ? { [userId]: forceContext } : undefined);
  }

  // Exposed for Tests
  getMessages() { return this.state.messages; }
  clear() { this.state.messages = []; this.notify(); }

  private async ensureSessionExists(sessionId: string) {
    const existing = await sessionDatabase.getSession(sessionId);
    if (existing) return;
    await sessionDatabase.saveSession(sessionId, `Session ${sessionId.substring(0, 6)}`);
  }

  private async flushOutgoingQueue(forceContexts?: Record<string, string>) {
    if (this.queueFlushInFlight) return;
    this.queueFlushInFlight = true;
    try {
      const now = Date.now();
      const all = await sessionDatabase.listOutgoing();
      const eligible = all
        .filter((x) => x.status !== "in_flight" && Date.parse(x.nextRetryAt) <= now)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

      for (const item of eligible) {
        await this.deliverQueueItem(item.id, forceContexts?.[item.id]);
      }
    } finally {
      this.queueFlushInFlight = false;
    }
  }

  private async deliverQueueItem(id: string, forceContext?: string) {
    const item = await sessionDatabase.getOutgoing(id);
    if (!item) return;

    const attempt = item.attempts + 1;
    await sessionDatabase.updateOutgoing(id, { status: "in_flight", attempts: attempt, lastError: undefined });
    await sessionDatabase.updateMessage(id, { deliveryStatus: "pending", deliveryError: undefined });
    await sessionDatabase.updateMessage(`${id}-assistant`, { deliveryStatus: "pending", deliveryError: undefined, isPartial: true, refusal: false });

    const sessionId = item.sessionId;
    const messages = (await persistenceService.loadChat(sessionId)) ?? [];

    const userIdx = messages.findIndex((m) => m.id === id);
    if (userIdx >= 0) {
      messages[userIdx] = { ...messages[userIdx], deliveryStatus: "pending", deliveryError: undefined };
    }
    const assistantIdx = messages.findIndex((m) => m.id === `${id}-assistant`);
    if (assistantIdx >= 0) {
      messages[assistantIdx] = { ...messages[assistantIdx], deliveryStatus: "pending", deliveryError: undefined, refusal: false, isPartial: true, text: "" };
    }

    if (this.sessionId === sessionId) {
      this.state.messages = messages;
      this.state.sending = true;
      this.notify();
    }

    const searchContext = await this.buildSearchContext({
      text: item.text,
      searchEnabled: item.searchEnabled,
      forceContext
    });

    const assistantId = `${id}-assistant`;
    const completionMessages = messages
      .filter((m) => m.id !== assistantId)
      .map((m) => {
        let content = m.text;
        if (m.id === id && searchContext) content += searchContext;
        return { role: m.from === "user" ? "user" : "assistant", content } as const;
      });

    try {
      let collected = "";
      let firstTokenTime: number | undefined;
      const startTime = Date.now();
      let tokenCount = 0;
      let lastPersistAt = 0;

      for await (const token of knezClient.chatCompletionsStream(completionMessages, sessionId)) {
        if (!firstTokenTime) firstTokenTime = Date.now();
        collected += token;
        tokenCount++;
        const patch: Partial<ChatMessage> = {
          text: collected,
          metrics: {
            timeToFirstTokenMs: firstTokenTime - startTime,
            totalTokens: tokenCount
          }
        };
        if (this.sessionId === sessionId) {
          this.state.messages = this.state.messages.map((m) => m.id === assistantId ? { ...m, ...patch } : m);
          this.notify();
        }
        const now = Date.now();
        if (now - lastPersistAt > 650) {
          lastPersistAt = now;
          await sessionDatabase.updateMessage(assistantId, { text: collected, metrics: patch.metrics, isPartial: true });
        }
      }

      if (tokenCount === 0 && collected.trim().length === 0) {
        throw new Error("Empty reply");
      }

      const finalAssistant: Partial<ChatMessage> = {
        isPartial: false,
        text: collected,
        deliveryStatus: "delivered",
        metrics: { finishReason: "stop", totalTokens: tokenCount }
      };

      await sessionDatabase.updateMessage(id, { deliveryStatus: "delivered" });
      await sessionDatabase.updateMessage(assistantId, { deliveryStatus: "delivered", text: collected, metrics: finalAssistant.metrics, isPartial: false, refusal: false });
      await sessionDatabase.removeOutgoing(id);

      if (this.sessionId === sessionId) {
        this.state.messages = this.state.messages.map((m) => {
          if (m.id === id) return { ...m, deliveryStatus: "delivered" };
          if (m.id === assistantId) return { ...m, ...finalAssistant };
          return m;
        });
      }

      await this.maybeAutoNameSession(sessionId, (await persistenceService.loadChat(sessionId)) ?? []);
    } catch (err: any) {
      const errorMsg = asErrorMessage(err);
      const nextRetryAt = new Date(Date.now() + Math.min(60000, 1000 * Math.pow(2, Math.min(6, attempt)))).toISOString();
      await sessionDatabase.updateOutgoing(id, { status: "failed", nextRetryAt, lastError: errorMsg });
      await sessionDatabase.updateMessage(id, { deliveryStatus: "failed", deliveryError: errorMsg });
      await sessionDatabase.updateMessage(`${id}-assistant`, { deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, text: `Error: ${errorMsg}`, refusal: true });

      if (this.sessionId === sessionId) {
        this.state.messages = this.state.messages.map((m) => {
          if (m.id === id) return { ...m, deliveryStatus: "failed", deliveryError: errorMsg };
          if (m.id === `${id}-assistant`) return { ...m, deliveryStatus: "failed", deliveryError: errorMsg, isPartial: false, text: `Error: ${errorMsg}`, refusal: true };
          return m;
        });
      }
    } finally {
      if (this.sessionId === sessionId) {
        this.state.sending = false;
        this.notify();
      }
    }
  }

  private async buildSearchContext(opts: { text: string; searchEnabled: boolean; forceContext?: string }): Promise<string> {
    if (opts.forceContext) return opts.forceContext;
    if (!opts.searchEnabled) return "";

    const urlMatch = opts.text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      const res = await extractionService.extract(urlMatch[0], 'raw');
      if (!res.error) {
        return `\n\n[SYSTEM: Web Extraction Result for ${urlMatch[0]}]\nSummary: ${res.summary}\nData: ${JSON.stringify(res.data)}`;
      }
      return "";
    }

    const results = await extractionService.search(opts.text, 5);
    if (results.length === 0) return "";
    const top = results.slice(0, 3);
    const extracts = [];
    for (const r of top.slice(0, 2)) {
      const ex = await extractionService.extract(r.url, "raw");
      if (!ex.error) {
        extracts.push({
          url: r.url,
          title: r.title,
          summary: ex.data?.description || ex.data?.title || ex.summary,
          snippet: ex.data?.content_snippet
        });
      }
    }

    return (
      `\n\n[SYSTEM: Web Search Enabled]\n` +
      `Query: ${opts.text}\n` +
      `Top results:\n` +
      top.map((r, idx) => `${idx + 1}. ${r.title}\n${r.url}`).join("\n\n") +
      (extracts.length > 0 ? `\n\n[SYSTEM: Extraction Snapshots]\n${JSON.stringify(extracts)}` : "")
    );
  }

  private async maybeAutoNameSession(sessionId: string, messages: ChatMessage[]) {
    const session = await sessionDatabase.getSession(sessionId);
    const defaultName = `Session ${sessionId.substring(0, 6)}`;
    const currentName = session?.name ?? defaultName;
    if (currentName !== defaultName) return;

    const userMessages = messages.filter(m => m.from === "user").slice(0, 5);
    if (userMessages.length === 0) return;

    const title = deriveSessionTitle(userMessages.map(m => m.text));
    if (!title) return;
    await sessionDatabase.updateSessionName(sessionId, title);
  }
}

export const chatService = new ChatService();

function deriveSessionTitle(inputs: string[]): string | null {
  const stop = new Set([
    "the","a","an","and","or","to","of","in","on","for","with","is","are","was","were","be","been","being",
    "i","you","we","they","he","she","it","my","your","our","their","this","that","these","those",
    "please","help","can","could","would","should","what","how","why","when","where"
  ]);

  const cleaned = inputs
    .map(t => t.replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").toLowerCase())
    .join(" ");

  const words = cleaned.split(/\s+/).map(w => w.trim()).filter(Boolean);
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 3) continue;
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w);
  if (top.length === 0) {
    const fallback = inputs[0].trim();
    if (!fallback) return null;
    const short = fallback.split(/\s+/).slice(0, 6).join(" ");
    return titleCase(short);
  }
  return titleCase(top.join(" "));
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : "")
    .join(" ")
    .trim();
}

function newMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}
