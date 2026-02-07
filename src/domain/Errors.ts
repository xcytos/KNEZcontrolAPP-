export type ErrorCode =
  | "KNEZ_HEALTH_FAILED"
  | "KNEZ_TIMEOUT"
  | "KNEZ_FETCH_FAILED"
  | "KNEZ_COMPLETION_FAILED"
  | "KNEZ_STREAM_FAILED"
  | "KNEZ_STREAM_EMPTY"
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
  if (err instanceof Error) return err.message;
  return String(err);
}
