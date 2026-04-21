import { knezClient } from "../knez/KnezClient";
import { observe } from "../../utils/observer";

export type SessionControllerState = {
  sessionId: string;
};

export type SessionControllerListener = (state: SessionControllerState) => void;

class SessionController {
  private listeners: SessionControllerListener[] = [];
  private state: SessionControllerState;

  constructor() {
    const existing = knezClient.getSessionId();
    const sessionId = existing ?? knezClient.createNewLocalSession();
    this.state = { sessionId };
  }

  subscribe(listener: SessionControllerListener) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getSessionId(): string {
    return this.state.sessionId;
  }

  private setSessionId(sessionId: string) {
    this.state = { sessionId };
    knezClient.setSessionId(sessionId);
    observe("session_changed", { sessionId });
    this.listeners.forEach((l) => l(this.state));
  }

  ensureLocalSession(): string {
    const existing = this.state.sessionId;
    if (existing) return existing;
    const created = knezClient.createNewLocalSession();
    this.setSessionId(created);
    return created;
  }

  async ensureOnlineSession(): Promise<string> {
    const sessionId = await knezClient.ensureSession();
    this.setSessionId(sessionId);
    return sessionId;
  }

  createNewSession(): string {
    const created = knezClient.createNewLocalSession();
    this.setSessionId(created);
    return created;
  }

  useSession(sessionId: string): string {
    this.setSessionId(sessionId);
    return sessionId;
  }

  async resumeSession(sourceSessionId: string, activate: boolean = true): Promise<string> {
    const newSessionId = await knezClient.resumeSession(sourceSessionId);
    if (activate) this.setSessionId(newSessionId);
    return newSessionId;
  }

  async forkSession(sourceSessionId: string, messageId?: string, activate: boolean = true): Promise<string> {
    const newSessionId = await knezClient.forkSession(sourceSessionId, messageId);
    if (activate) this.setSessionId(newSessionId);
    return newSessionId;
  }
}

export const sessionController = new SessionController();
