export type ErrorCode =
  | "KNEZ_HEALTH_FAILED"
  | "KNEZ_TIMEOUT"
  | "KNEZ_FETCH_FAILED"
  | "KNEZ_COMPLETION_FAILED"
  | "KNEZ_STREAM_FAILED"
  | "KNEZ_STREAM_EMPTY"
  | "KNEZ_SESSION_CREATE_FAILED"
  | "OLLAMA_STATUS_FAILED"
  | "OLLAMA_STATUS_FETCH_FAILED"
  | "LOAD_MODEL_FAILED"
  | "LOAD_MODEL_FETCH_FAILED"
  | "PERSISTENCE_FAILED";

export class AppError extends Error {
  code: ErrorCode;
  details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function asErrorMessage(err: unknown): string {
  if (err instanceof AppError) return `[${err.code}] ${err.message}`;
  if (err && typeof err === "object" && "name" in err) {
    const name = String((err as any).name);
    if (name === "AbortError") return "Request cancelled";
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
