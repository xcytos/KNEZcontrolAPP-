import { knezClient } from "./KnezClient";
import type { ExposedToolMeta } from "./ToolExposureService";

type GovernanceDecision = { allowed: boolean; reason?: string; combinedSha256?: string | null };

function extractStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function pickFirstString(value: any): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

export class GovernanceService {
  private cachedAt = 0;
  private cachedSnapshot: any | null = null;
  private cachedHash: string | null = null;
  private inFlight: Promise<any | null> | null = null;

  async getSnapshot(opts?: { maxAgeMs?: number }): Promise<{ snapshot: any | null; combinedSha256: string | null }> {
    const maxAgeMs = typeof opts?.maxAgeMs === "number" ? opts.maxAgeMs : 2500;
    const now = Date.now();
    if (this.cachedSnapshot && now - this.cachedAt < maxAgeMs) {
      return { snapshot: this.cachedSnapshot, combinedSha256: this.cachedHash };
    }
    if (this.inFlight) {
      const snap = await this.inFlight;
      return { snapshot: snap, combinedSha256: this.cachedHash };
    }
    this.inFlight = (async () => {
      const snap = await knezClient.getGovernanceSnapshot().catch(() => null);
      this.cachedSnapshot = snap;
      this.cachedAt = Date.now();
      const hash =
        pickFirstString((snap as any)?.combined_sha256) ??
        pickFirstString((snap as any)?.sha256) ??
        pickFirstString((snap as any)?.hash) ??
        null;
      this.cachedHash = hash;
      return snap;
    })().finally(() => {
      this.inFlight = null;
    });
    const snap = await this.inFlight;
    return { snapshot: snap, combinedSha256: this.cachedHash };
  }

  private collectBlockedTools(snapshot: any): string[] {
    const direct = [
      ...extractStringArray(snapshot?.blocked_tools),
      ...extractStringArray(snapshot?.blockedTools),
      ...extractStringArray(snapshot?.disabled_tools),
      ...extractStringArray(snapshot?.disabledTools),
      ...extractStringArray(snapshot?.deny_tools),
      ...extractStringArray(snapshot?.denyTools),
    ];
    const nested = [
      ...extractStringArray(snapshot?.mcp?.blocked_tools),
      ...extractStringArray(snapshot?.mcp?.disabled_tools),
      ...extractStringArray(snapshot?.tools?.blocked_tools),
      ...extractStringArray(snapshot?.tools?.disabled_tools),
      ...extractStringArray(snapshot?.policy?.blocked_tools),
      ...extractStringArray(snapshot?.policy?.disabled_tools),
    ];
    return Array.from(new Set([...direct, ...nested].map((s) => s.trim()).filter(Boolean)));
  }

  async decideTool(meta: ExposedToolMeta): Promise<GovernanceDecision> {
    const { snapshot, combinedSha256 } = await this.getSnapshot();

    const isHighRisk = meta.riskLevel === "high";
    if (!snapshot) {
      if (isHighRisk) {
        return { allowed: false, reason: "governance_snapshot_unavailable", combinedSha256 };
      }
      return { allowed: true, combinedSha256 };
    }

    const blocked = this.collectBlockedTools(snapshot);
    const namesToMatch = new Set<string>([
      meta.name,
      `${meta.serverId}__${meta.originalName}`,
      meta.originalName,
      `${meta.serverId}:${meta.originalName}`,
    ]);
    for (const rule of blocked) {
      if (namesToMatch.has(rule)) {
        return { allowed: false, reason: "blocked_by_governance", combinedSha256 };
      }
      if (rule.endsWith("__*")) {
        const prefix = rule.slice(0, -2);
        if (meta.name.startsWith(prefix)) {
          return { allowed: false, reason: "blocked_by_governance", combinedSha256 };
        }
      }
    }

    const allowHighRisk =
      snapshot?.allow_high_risk_tools ??
      snapshot?.allowHighRiskTools ??
      snapshot?.mcp?.allow_high_risk_tools ??
      snapshot?.mcp?.allowHighRiskTools ??
      null;
    if (allowHighRisk === false && isHighRisk) {
      return { allowed: false, reason: "high_risk_blocked_by_governance", combinedSha256 };
    }

    return { allowed: true, combinedSha256 };
  }
}

export const governanceService = new GovernanceService();
