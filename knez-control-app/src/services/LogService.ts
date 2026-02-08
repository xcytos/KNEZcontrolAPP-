
import { writeTextFile, BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import { redactAny, redactString } from "../utils/redact";

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
  private logFile = "app-runtime.log";
  private lastLogByKey = new Map<string, number>();
  private consoleMirror = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
  private consoleHooked = false;

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

    this.hydrate();
    this.hookConsole();
  }

  private hookConsole() {
    if (this.consoleHooked) return;
    this.consoleHooked = true;

    const toText = (args: any[]) =>
      args
        .map((a) => {
          if (typeof a === "string") return a;
          try {
            return JSON.stringify(a);
          } catch {
            try {
              return String(a);
            } catch {
              return "[unprintable]";
            }
          }
        })
        .join(" ");

    console.log = (...args: any[]) => {
      this.consoleMirror.log(...args);
      this.debug("console", toText(args));
    };
    console.info = (...args: any[]) => {
      this.consoleMirror.info(...args);
      this.info("console", toText(args));
    };
    console.warn = (...args: any[]) => {
      this.consoleMirror.warn(...args);
      this.warn("console", toText(args));
    };
    console.error = (...args: any[]) => {
      this.consoleMirror.error(...args);
      this.error("console", toText(args));
    };
  }

  private async hydrate() {
    try {
       // Read last N lines? 
       // For now, let's just ensure the file exists.
       // Reading the whole file might be large.
       // We skip full hydration for performance in this MVP, but we ensure the file is created.
       // To truly satisfy "persist across restarts" VISIBLY, we should read it.
       // Let's try to read it.
       const content = await import('@tauri-apps/plugin-fs').then(fs => 
         fs.readTextFile(this.logFile, { baseDir: BaseDirectory.AppLocalData })
       );
       
       if (content && typeof content === 'string') {
         const lines = content.split('\n').filter(Boolean).slice(-100); // Last 100
         lines.forEach(line => {
            try {
              const entry = JSON.parse(line);
              this.logs.push(entry); // Push to end (oldest first? No, logs are unshifted... wait)
              // this.logs is displayed oldest to newest?
              // this.add unshifts (newest first).
              // So we should push these to the end?
              // If we read from file (oldest to newest lines), we should probably put them at the end if we display newest first?
              // Wait, `this.logs.unshift(entry)` puts NEWEST at index 0.
              // So we want file lines (oldest) to be at the end of the array.
              // So `this.logs.push(entry)` is correct if we iterate lines oldest to newest.
            } catch {}
         });
         // Notify?
       }
    } catch (e) {
       // File might not exist
    }
  }

  private async persistLog(entry: LogEntry) {
     try {
       const line = JSON.stringify(entry) + "\n";
       // Emulate append: Read -> Concat -> Write
    // Note: This is not atomic and race-prone, but sufficient for single-user desktop log.
    let current = "";
    try {
      const content = await readTextFile(this.logFile, { baseDir: BaseDirectory.AppLocalData });
      if (typeof content === 'string') {
        current = content;
      }
    } catch {
      // File missing, empty
    }
    
    // Limit file size (approx 1MB)
    if (typeof current === 'string' && current.length > 1024 * 1024) {
      current = current.substring(current.length - 512 * 1024); // Keep last half
    }

    await writeTextFile(this.logFile, current + line, { baseDir: BaseDirectory.AppLocalData });
     } catch (e) {
       // Silent fail
     }
  }

  private add(level: LogLevel, category: string, message: string, details?: any) {
    let id: string;
    try {
      id = crypto.randomUUID();
    } catch {
      id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    const safeMessage = redactString(message);
    const safeDetails = details === undefined ? undefined : redactAny(details);

    const entry: LogEntry = {
      id,
      timestamp: new Date().toISOString(),
      level,
      category,
      message: safeMessage,
      details: safeDetails,
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
    this.consoleMirror.log(`%c[${category}] ${safeMessage}`, style, safeDetails || "");

    this.notify(entry);
    this.persistLog(entry);
  }

  debug(category: string, message: string, details?: any) {
    this.add(LogLevel.DEBUG, category, message, details);
  }

  debugThrottled(key: string, throttleMs: number, category: string, message: string, details?: any) {
    this.addThrottled(key, throttleMs, LogLevel.DEBUG, category, message, details);
  }

  info(category: string, message: string, details?: any) {
    this.add(LogLevel.INFO, category, message, details);
  }

  infoThrottled(key: string, throttleMs: number, category: string, message: string, details?: any) {
    this.addThrottled(key, throttleMs, LogLevel.INFO, category, message, details);
  }

  warn(category: string, message: string, details?: any) {
    this.add(LogLevel.WARN, category, message, details);
  }

  warnThrottled(key: string, throttleMs: number, category: string, message: string, details?: any) {
    this.addThrottled(key, throttleMs, LogLevel.WARN, category, message, details);
  }

  error(category: string, message: string, details?: any) {
    this.add(LogLevel.ERROR, category, message, details);
  }

  errorThrottled(key: string, throttleMs: number, category: string, message: string, details?: any) {
    this.addThrottled(key, throttleMs, LogLevel.ERROR, category, message, details);
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

  private addThrottled(
    key: string,
    throttleMs: number,
    level: LogLevel,
    category: string,
    message: string,
    details?: any
  ) {
    const now = Date.now();
    const last = this.lastLogByKey.get(key) ?? 0;
    if (now - last < Math.max(0, throttleMs)) return;
    this.lastLogByKey.set(key, now);
    this.add(level, category, message, details);
  }
}

export const logger = new LogService();
