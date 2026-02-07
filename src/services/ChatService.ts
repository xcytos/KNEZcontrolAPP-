
import { knezClient } from "./KnezClient";
import { extractionService } from "./ExtractionService";
import { persistenceService } from "./PersistenceService";
import { ChatMessage } from "../domain/DataContracts";
import { observe } from "../utils/observer";

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
  private sessionId: string | null = null;

  constructor() {
    this.sessionId = knezClient.getSessionId();
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

  setSessionId(id: string) {
    this.sessionId = id;
    // Load state?
    this.load(id);
  }

  async load(sessionId: string) {
    const loaded = await persistenceService.loadChat(sessionId);
    if (loaded && loaded.length > 0) {
      this.state.messages = loaded;
    } else {
      this.state.messages = [{
         id: "seed",
         sessionId: sessionId,
         from: "knez",
         text: "KNEZ client ready.",
         createdAt: new Date().toISOString(),
      }];
    }
    this.notify();
  }

  setActiveTools(tools: { search: boolean }) {
    this.state.activeTools = tools;
    this.notify();
  }

  async sendMessage(text: string, forceContext?: string): Promise<void> {
    if (!this.sessionId || !text.trim() || this.state.sending) return;

    this.state.sending = true;
    const now = new Date().toISOString();
    const startTime = Date.now();
    
    // Tool Logic
    let searchContext = forceContext || "";
    if (this.state.activeTools.search && !forceContext) {
       const urlMatch = text.match(/https?:\/\/[^\s]+/);
       if (urlMatch) {
          const res = await extractionService.extract(urlMatch[0], 'raw');
          if (!res.error) {
             searchContext = `\n\n[SYSTEM: Web Extraction Result for ${urlMatch[0]}]\nSummary: ${res.summary}\nData: ${JSON.stringify(res.data)}`;
          }
       }
    }

    const userMsg: ChatMessage = {
      id: `${startTime}`,
      sessionId: this.sessionId,
      from: "user",
      text: text,
      createdAt: now,
    };

    const assistantId = `${startTime}-assistant`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      sessionId: this.sessionId,
      from: "knez",
      text: "",
      createdAt: now,
      isPartial: true,
      metrics: { totalTokens: 0 }
    };

    this.state.messages = [...this.state.messages, userMsg, assistantMsg];
    this.notify();
    observe("chat_send_attempt", { sessionId: this.sessionId, message: text });

    // Stream
    const completionMessages = [...this.state.messages] // includes the new partials, but logic below filters correctly
      .filter(m => m.id !== assistantId) // remove the empty assistant msg we just added for context
      .filter(m => m.id !== "seed")
      .map(m => {
         let content = m.text;
         if (m.id === userMsg.id && searchContext) content += searchContext;
         return { role: m.from === "user" ? "user" : "assistant", content } as const;
      });

    try {
      let collected = "";
      let firstTokenTime: number | undefined;
      let tokenCount = 0;

      for await (const token of knezClient.chatCompletionsStream(completionMessages, this.sessionId)) {
        if (!firstTokenTime) firstTokenTime = Date.now();
        collected += token;
        tokenCount++;
        
        // Update in-place
        this.state.messages = this.state.messages.map(m => m.id === assistantId ? {
           ...m,
           text: collected,
           metrics: {
             timeToFirstTokenMs: firstTokenTime! - startTime,
             totalTokens: tokenCount
           }
        } : m);
        this.notify();
      }

      // Finalize
      this.state.messages = this.state.messages.map(m => m.id === assistantId ? {
        ...m,
        isPartial: false,
        metrics: { ...m.metrics, finishReason: "stop" }
      } : m);

      // Save
      persistenceService.saveChat(this.sessionId, this.state.messages);

    } catch (err: any) {
      const errorMsg = String(err);
      this.state.messages = this.state.messages.map(m => m.id === assistantId ? {
        ...m,
        text: `Error: ${errorMsg}`,
        refusal: true,
        isPartial: false
      } : m);
    } finally {
      this.state.sending = false;
      this.notify();
    }
  }

  // Exposed for Tests
  getMessages() { return this.state.messages; }
  clear() { this.state.messages = []; this.notify(); }
}

export const chatService = new ChatService();
