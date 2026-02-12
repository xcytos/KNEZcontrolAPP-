export type McpTrafficEvent =
  | { kind: "raw_stdout"; at: number; text: string }
  | { kind: "raw_stderr"; at: number; text: string }
  | { kind: "parse_error"; at: number; framing: "content-length" | "line"; detail: string; preview: string }
  | { kind: "request"; at: number; id: string; method: string; json: any }
  | { kind: "response"; at: number; id: string; ok: boolean; json: any }
  | { kind: "unsolicited"; at: number; id: string | null; ok: boolean; json: any }
  | { kind: "process_closed"; at: number; code: number | null }
  | { kind: "spawn_error"; at: number; message: string };
