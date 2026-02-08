import { logger } from "./LogService";
import type { View } from "../components/layout/Sidebar";

type TabErrors = Partial<Record<View, boolean>>;

function mapCategoryToView(category: string): View | null {
  const c = category.toLowerCase();
  if (c === "chat") return "chat";
  if (c.includes("memory")) return "memory";
  if (c.includes("cognitive") || c.includes("drift") || c.includes("mistake")) return "memory";
  if (c.includes("mcp") || c.includes("taqwin")) return "mcp";
  if (c.includes("extract")) return "extraction";
  if (c.includes("diagnostic") || c.includes("test")) return "diagnostics";
  if (c.includes("skill")) return "skills";
  if (c.includes("knez_client") || c.includes("runtime") || c.includes("system")) return "infrastructure";
  return null;
}

class TabErrorStore {
  private errors: TabErrors = {};
  private listeners: Array<(errors: TabErrors) => void> = [];

  constructor() {
    logger.subscribe((entry) => {
      if (entry.level !== "ERROR") return;
      const view = mapCategoryToView(entry.category);
      this.errors = { ...this.errors, logs: true, ...(view ? { [view]: true } : {}) };
      this.notify();
    });
  }

  get(): TabErrors {
    return this.errors;
  }

  mark(view: View) {
    this.errors = { ...this.errors, [view]: true };
    this.notify();
  }

  clear(view: View) {
    this.errors = { ...this.errors, [view]: false };
    this.notify();
  }

  subscribe(listener: (errors: TabErrors) => void): () => void {
    this.listeners.push(listener);
    listener(this.errors);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.errors));
  }
}

export const tabErrorStore = new TabErrorStore();
