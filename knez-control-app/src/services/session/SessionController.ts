import { knezClient } from "../knez/KnezClient";
import { observe } from "../../utils/observer";

export type SessionControllerState = {
  sessionId: string;
};

export type SessionControllerListener = (state: SessionControllerState) => void;

class SessionController {
  private listeners: SessionControllerListener[] = [];
  private state: SessionControllerState;
  private sessionOperationLock: Promise<any> = Promise.resolve();

  constructor() {
    const existing = knezClient.getSessionId();
    const sessionId = existing ?? "";
    this.state = { sessionId };
    if (!existing) {
      void this.initializeSession();
    }
  }

  private async initializeSession(): Promise<void> {
    const created = await knezClient.createNewLocalSession();
    this.setSessionId(created);
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

  async ensureLocalSession(): Promise<string> {
    const existing = this.state.sessionId;
    if (existing) return existing;
    const created = await knezClient.createNewLocalSession();
    this.setSessionId(created);
    return created;
  }

  async ensureOnlineSession(): Promise<string> {
    const lock = this.sessionOperationLock.then(async () => {
      const sessionId = await knezClient.ensureSession();
      this.setSessionId(sessionId);
      return sessionId;
    });
    this.sessionOperationLock = lock;
    return lock;
  }

  async createNewSession(): Promise<string> {
    const created = await knezClient.createNewLocalSession();
    this.setSessionId(created);
    return created;
  }

  useSession(sessionId: string): string {
    this.setSessionId(sessionId);
    return sessionId;
  }

  async resumeSession(sourceSessionId: string, activate: boolean = true): Promise<string> {
    const lock = this.sessionOperationLock.then(async () => {
      const newSessionId = await knezClient.resumeSession(sourceSessionId);
      if (activate) this.setSessionId(newSessionId);
      return newSessionId;
    });
    this.sessionOperationLock = lock;
    return lock;
  }

  async forkSession(sourceSessionId: string, messageId?: string, activate: boolean = true): Promise<string> {
    const lock = this.sessionOperationLock.then(async () => {
      const newSessionId = await knezClient.forkSession(sourceSessionId, messageId);
      if (activate) this.setSessionId(newSessionId);
      return newSessionId;
    });
    this.sessionOperationLock = lock;
    return lock;
  }
}

export const sessionController = new SessionController();
