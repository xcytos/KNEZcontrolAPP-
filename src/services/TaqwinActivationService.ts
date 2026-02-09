import { taqwinMcpService } from "../mcp/taqwin/TaqwinMcpService";

export type TaqwinActivationStatus = {
  state: "idle" | "starting" | "running" | "error";
  lastOkAt: number | null;
  lastError: string | null;
};

class TaqwinActivationService {
  private status: TaqwinActivationStatus = { state: "idle", lastOkAt: null, lastError: null };
  private listeners = new Set<(s: TaqwinActivationStatus) => void>();

  getStatus(): TaqwinActivationStatus {
    return this.status;
  }

  subscribe(listener: (s: TaqwinActivationStatus) => void): () => void {
    this.listeners.add(listener);
    try {
      listener(this.status);
    } catch {}
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) {
      try {
        l(this.status);
      } catch {}
    }
  }

  async activate(opts: { sessionId: string; knezEndpoint: string; checkpoint?: string }) {
    if (this.status.state === "starting") return;
    this.status = { state: "starting", lastOkAt: this.status.lastOkAt, lastError: null };
    this.emit();
    try {
      const res = await taqwinMcpService.activateTaqwin({
        sessionId: opts.sessionId,
        knezEndpoint: opts.knezEndpoint,
        checkpoint: opts.checkpoint
      });
      this.status = { state: "running", lastOkAt: Date.now(), lastError: null };
      this.emit();
      return res;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      this.status = { state: "error", lastOkAt: this.status.lastOkAt, lastError: msg };
      this.emit();
      throw e;
    }
  }
}

export const taqwinActivationService = new TaqwinActivationService();
