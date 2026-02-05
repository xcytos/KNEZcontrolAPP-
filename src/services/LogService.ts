
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  details?: any;
}

class LogService {
  private logs: LogEntry[] = [];
  private listeners: ((log: LogEntry) => void)[] = [];
  private maxLogs = 1000;

  constructor() {
    // Capture unhandled errors
    window.addEventListener("error", (event) => {
      this.error("runtime", "Unhandled Exception", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.error("runtime", "Unhandled Promise Rejection", {
        reason: event.reason,
      });
    });
  }

  private add(level: LogLevel, category: string, message: string, details?: any) {
    let id: string;
    try {
      id = crypto.randomUUID();
    } catch {
      id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    const entry: LogEntry = {
      id,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Console mirror
    const style =
      level === LogLevel.ERROR
        ? "color: red"
        : level === LogLevel.WARN
        ? "color: orange"
        : "color: cyan";
    console.log(`%c[${category}] ${message}`, style, details || "");

    this.notify(entry);
  }

  debug(category: string, message: string, details?: any) {
    this.add(LogLevel.DEBUG, category, message, details);
  }

  info(category: string, message: string, details?: any) {
    this.add(LogLevel.INFO, category, message, details);
  }

  warn(category: string, message: string, details?: any) {
    this.add(LogLevel.WARN, category, message, details);
  }

  error(category: string, message: string, details?: any) {
    this.add(LogLevel.ERROR, category, message, details);
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  subscribe(callback: (log: LogEntry) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notify(log: LogEntry) {
    this.listeners.forEach((l) => l(log));
  }
}

export const logger = new LogService();
