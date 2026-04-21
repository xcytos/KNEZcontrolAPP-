class AnalyticsService {
  private static STORAGE_KEY = 'knez_analytics';

  private stats = {
    messagesSent: 0,
    errors: 0,
    sessionsCreated: 0,
    agentTasks: 0
  };

  constructor() {
    this.load();
  }

  private load() {
    const raw = localStorage.getItem(AnalyticsService.STORAGE_KEY);
    if (raw) {
      try {
        this.stats = { ...this.stats, ...JSON.parse(raw) };
      } catch {}
    }
  }

  private save() {
    localStorage.setItem(AnalyticsService.STORAGE_KEY, JSON.stringify(this.stats));
  }

  trackMessage() {
    this.stats.messagesSent++;
    this.save();
  }

  trackError() {
    this.stats.errors++;
    this.save();
  }
  
  trackSession() {
    this.stats.sessionsCreated++;
    this.save();
  }

  trackAgentTask() {
    this.stats.agentTasks++;
    this.save();
  }

  getStats() {
    return { ...this.stats };
  }
}

export const analytics = new AnalyticsService();
