TAQWIN MCP Host Eligibility and Integration Guide
=================================================

Version: 1.0.0  
Applies to: TAQWIN V1 MCP Server (JSON‑RPC 2.0 over STDIO, Protocol `2024-11-05`)

This document defines what it means for an MCP host to be **compatible** with the TAQWIN V1 MCP server, and how to use it **correctly and reliably**. It is written for:

- MCP host implementers (editors, CLIs, agent frameworks)
- Integrators who want to wire TAQWIN as an MCP server into their systems
- Operators who need to debug or diagnose MCP connectivity and tool usage

It complements the normative protocol description in:

- docs/contracts/mcp_contract_v1.md
- docs/contracts/tools_contract_v1.md

Where the contracts describe *what TAQWIN guarantees*, this guide describes *what a host must do* to:

- Connect reliably
- Negotiate framing and JSON‑RPC envelopes correctly
- Discover the available tools
- Call tools in a robust, production‑ready way
- Handle failures, timeouts, and restarts without corrupting the session

----------------------------------------------------------------------
1. Conceptual Model
----------------------------------------------------------------------

An MCP host is any process that:

- Launches TAQWIN as a subprocess (MCP server) using a configured command
- Talks to TAQWIN over STDIO using JSON‑RPC 2.0 envelopes
- Implements MCP‑level methods:
  - `initialize`
  - `tools/list`
  - `tools/call`
- Optionally provides richer capabilities on top (chat UI, logging, etc.)

At a high level:

1. The host **spawns** TAQWIN with the correct working directory and environment.
2. The host and server agree on a **framing mode** for JSON over STDIO.
3. The host sends an **`initialize`** request and receives capabilities and serverInfo.
4. The host calls **`tools/list`** to discover the fixed tool catalog.
5. The host issues **`tools/call`** requests to execute tools.
6. The host handles **errors**, **timeouts**, and **restarts** without sending malformed traffic.

A host is considered **eligible** and **well‑behaved** if it satisfies all criteria in this document.

----------------------------------------------------------------------
2. Launch and Process‑Level Requirements
----------------------------------------------------------------------

2.1. Executable and Arguments
-----------------------------

The host MUST launch TAQWIN using a command equivalent to:

- Command: an absolute, valid Python 3.11+ executable
- Arguments:
  - `-u`
  - Absolute path to `main.py` in the TAQWIN repo root

Example (Windows):

- Command:
  - `C:\Users\syedm\AppData\Local\Programs\Python\Python313\python.exe`
- Arguments:
  - `-u`
  - `C:\Users\syedm\Downloads\ASSETS\controlAPP\TAQWIN_V1\main.py`

Eligibility criteria:

- The MCP host configuration MUST NOT rely on bare `python` that may resolve to the wrong interpreter or environment.
- The MCP host MUST use absolute paths for:
  - The Python interpreter
  - The TAQWIN entrypoint (`main.py`)
  - The working directory (see below)


2.2. Working Directory
----------------------

The host MUST set the working directory (`cwd`) of the TAQWIN process to the TAQWIN repo root, for example:

- `C:\Users\syedm\Downloads\ASSETS\controlAPP\TAQWIN_V1`

Rationale:

- TAQWIN expects relative paths for:
  - Data files
  - Logs
  - Session databases
  - Internal configuration

Eligibility criteria:

- If the host runs TAQWIN with a different working directory, it is **not** considered compliant.
- A compliant host MUST NOT override `cwd` to something arbitrary; it must match the repo root or a configured equivalent path that TAQWIN is prepared to handle.


2.3. Environment Variables
--------------------------

Required:

- `PYTHONUNBUFFERED = "1"`

Recommended (optional) environment:

- `TAQWIN_MCP_OUTPUT_MODE`:
  - `line` — force line‑delimited JSON responses
  - `content-length` — force Content‑Length framed responses
  - Omit to allow auto‑detection (recommended)

Eligibility criteria:

- The host MUST either:
  - Leave `TAQWIN_MCP_OUTPUT_MODE` unset and allow auto‑detection, or
  - Set it consistently with its own framing expectations.
- The host MUST NOT set conflicting values for different connections in a way that breaks symmetry between request framing and response framing.


2.4. Process Lifecycle
----------------------

The host MUST:

- Detect EOF from TAQWIN and stop reading immediately.
- Treat exit codes:
  - `0` as normal shutdown
  - Non‑zero as abnormal termination
- Avoid writing to STDIN after EOF or a known fatal exit.

Eligibility criteria:

- A compliant host MUST NOT attempt to reuse a terminated TAQWIN process.
- If the host restarts TAQWIN after an error, it MUST treat this as a **fresh session** and re‑run `initialize` before attempting any tool calls.

----------------------------------------------------------------------
3. Transport and Framing Requirements
----------------------------------------------------------------------

TAQWIN supports two input framing modes and two output framing modes:

- Input (host → TAQWIN):
  - Line JSON
  - Content‑Length framed JSON
- Output (TAQWIN → host):
  - Line JSON
  - Content‑Length framed JSON

3.1. Input: Line JSON
---------------------

Definition:

- One complete JSON object per line, encoded as UTF‑8 and terminated by `\n`.

Behavior in TAQWIN:

- TAQWIN reads from `sys.stdin.buffer.readline()`.
- Leading/trailing whitespace is stripped.
- The resulting line is parsed as JSON.

Host obligations:

- Each line MUST contain exactly one complete JSON object (no streaming arrays, no multiple objects on one line).
- Lines MUST be UTF‑8 encoded.
- Trailing whitespace is allowed but discouraged.

Eligibility criteria:

- Hosts using line JSON MUST NOT prepend HTTP‑style headers (like `Content-Length`) before the JSON line.
- Hosts MUST ensure that a line break is transmitted after every JSON object.


3.2. Input: Content‑Length Framed JSON
--------------------------------------

Definition:

- HTTP‑style header followed by a JSON body of that exact byte length.

Header rules:

- First header line MUST be `Content-Length: <decimal>` (case‑insensitive).
- Additional header lines are allowed but ignored by TAQWIN.
- Header block terminates at a blank line.

Body rules:

- TAQWIN reads exactly `<decimal>` bytes after the header block.
- Body MUST be UTF‑8 encoded JSON.

Eligibility criteria:

- Hosts using Content‑Length MUST adhere to the exact byte length semantics:
  - Byte length, not character count.
  - No extra bytes after the specified body before the next header block.


3.3. Output Mode Selection
--------------------------

TAQWIN determines its response framing mode as follows:

- If the **first inbound request** uses Content‑Length framing, TAQWIN:
  - Uses Content‑Length framing for all subsequent responses in that process.
- Otherwise:
  - Uses line‑delimited JSON for all responses.
- Overrides:
  - `TAQWIN_MCP_OUTPUT_MODE = "line"` forces line JSON.
  - `TAQWIN_MCP_OUTPUT_MODE = "content-length"` forces Content‑Length framing.

Eligibility criteria:

- The host MUST be capable of reading responses using the mode it implicitly or explicitly negotiates via the first request.
- The host MUST NOT assume the server will switch framing mid‑session.
- If the host uses line JSON for requests, it MUST read line JSON for responses.
- If the host uses Content‑Length, it MUST read Content‑Length headers and bodies correctly.


3.4. Framing Failure Modes
--------------------------

If the host mis‑frames data, common symptoms include:

- Host log:
  - "Unexpected token 'C', `Content-Length: 210` is not valid JSON"
  - "Unexpected end of JSON input"
- TAQWIN log:
  - Parse error responses with code `-32700`

Eligibility criteria:

- A host that cannot maintain a consistent, valid framing mode cannot be considered compliant.
- On any framing error:
  - The host SHOULD terminate the broken session.
  - The host SHOULD start a fresh TAQWIN process and re‑initialize with correct framing.

----------------------------------------------------------------------
4. JSON‑RPC Envelope Requirements
----------------------------------------------------------------------

TAQWIN uses JSON‑RPC 2.0 envelopes for all MCP methods.

4.1. Request Envelope
---------------------

All requests MUST follow the pattern:

- Required fields:
  - `"jsonrpc": "2.0"`
  - `"id"`: string or number
  - `"method"`: string
- Optional:
  - `"params"`: object

Examples:

- `initialize`:

  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": {
        "name": "Trae",
        "version": "1.107.1"
      }
    }
  }

- `tools/list`:

  {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }

- `tools/call`:

  {
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "scan_database",
      "arguments": {
        "action": "scan_overview",
        "database_type": "all",
        "include_cache": true
      }
    }
  }

Eligibility criteria:

- The host MUST send well‑formed JSON‑RPC 2.0 requests:
  - `jsonrpc` exactly `"2.0"`.
  - `id` present and of type string or number (no objects, arrays, or booleans).
  - `method` a non‑empty string.
  - `params`, when present, MUST be a JSON object.


4.2. Success Response Envelope
------------------------------

TAQWIN success responses follow:

{
  "jsonrpc": "2.0",
  "id": <same id as request>,
  "result": { ... }
}

Eligibility criteria:

- The host MUST be able to:
  - Parse the envelope.
  - Route the response to the corresponding pending request using `id`.
  - Handle numeric and string ids interchangeably.


4.3. Error Response Envelope
----------------------------

TAQWIN error responses follow:

{
  "jsonrpc": "2.0",
  "id": <echoed id or null>,
  "error": {
    "code": -32600,
    "message": "Invalid Request",
    "data": { ...optional... }
  }
}

Codes used include:

- `-32700` Parse error
- `-32600` Invalid Request
- `-32601` Method not found
- `-32602` Invalid params
- `-32603` Internal error

Eligibility criteria:

- The host MUST:
  - Treat `error` responses as MCP‑level errors.
  - Not assume that tools are unavailable just because one request returned an error.
  - Surface error codes and messages for debugging.

----------------------------------------------------------------------
5. MCP Method‑Level Requirements
----------------------------------------------------------------------

5.1. `initialize`
-----------------

Semantics:

- Establishes protocol compatibility.
- Returns:
  - `protocolVersion`
  - `capabilities`
  - `serverInfo`

Server behavior:

- TAQWIN does not require any specific content in `params` to construct the response.
- TAQWIN echoes `id` from the request.

Host obligations:

- MUST send `initialize` as the first JSON‑RPC request after process start.
- SHOULD include:
  - `protocolVersion` that it expects (e.g., `"2025-11-25"` or `"2024-11-05"`).
  - `clientInfo.name` and `clientInfo.version` for diagnostics.
- MUST wait for the `initialize` response before sending `tools/list` or `tools/call`.


5.2. `tools/list`
-----------------

Purpose:

- Discover the fixed tool catalog exported by TAQWIN.

Server behavior:

- Returns `result.tools` as a list of tool descriptors:
  - `name`: string
  - `description`: human‑readable
  - `inputSchema`: JSON Schema object describing arguments

Host obligations:

- SHOULD call `tools/list` after successful `initialize`.
- SHOULD cache the tool catalog per session.
- MUST respect the `inputSchema` for tool arguments:
  - Only send parameters defined in the schema.
  - Respect types (`string`, `number`, `boolean`, `array`, `object`).

Eligibility criteria:

- A host that never calls `tools/list` after successful `initialize` is considered **incompletely integrated**.
- A compliant host MUST be able to handle the full tool list returned by TAQWIN and present it appropriately (UI or internal logic).


5.3. `tools/call`
-----------------

Purpose:

- Execute a named tool with structured arguments.

Server behavior:

- Validates:
  - `params` is an object.
  - `params.name` is a non‑empty string matching a known tool.
  - `params.arguments` is an object (or omitted/null, treated as `{}`).
- Returns:
  - `result.content`: list of MCP content items.

Content rules:

- For typical TAQWIN tools:
  - `type = "text"`
  - `text` is a structured, often pretty‑printed JSON string, including:
    - `status`
    - `data` or `error`
    - Tool version
    - Timing and cache statistics

Host obligations:

- MUST construct `tools/call` with correct `params` shape.
- MUST handle both success and tool‑level error payloads inside `result.content`.
- SHOULD parse `text` where structured JSON is expected (e.g., from `scan_database`).

Eligibility criteria:

- A host that sends `params.arguments` as non‑object (e.g., array, string) will trigger `-32602` errors and is non‑compliant.
- A compliant host MUST properly route responses back to the pending `tools/call` requests using `id`.

----------------------------------------------------------------------
6. Tool‑Specific Expectations
----------------------------------------------------------------------

While this document is host‑oriented and not tool‑oriented, there are practical expectations:

- `activate_taqwin_unified_consciousness`:
  - Hosts SHOULD allow passing `query` or `message`.
  - Hosts MAY expose advanced options (modules, performance_mode, etc.).

- `get_server_status`:
  - Hosts SHOULD call this for diagnostics, especially after startup.

- `scan_database`:
  - Hosts MUST send appropriate `action` and `database_type`.
  - For `execute_query`, hosts MUST provide a `query` string.

- `web_intelligence`:
  - Structured responses may include multiple keys; hosts SHOULD display them as rich text or structured panels, not raw JSON.

Eligibility criteria:

- A host is most useful when it can:
  - Expose the full parameter set for each tool.
  - Render complex JSON content in a human‑readable way.

----------------------------------------------------------------------
7. Error Handling and Robustness
----------------------------------------------------------------------

7.1. Distinguishing MCP‑Level vs Tool‑Level Errors
--------------------------------------------------

MCP‑level errors:

- Delivered via `error` field in the JSON‑RPC envelope.
- Indicate:
  - Invalid requests
  - Unsupported methods
  - Framing or JSON parse errors
  - Internal server failures

Tool‑level errors:

- Delivered inside `result.content` (typically text JSON with `status: "ERROR"` or `success: false`).
- Indicate:
  - Invalid query semantics
  - Missing or invalid tool‑specific arguments
  - Downstream data issues

Eligibility criteria:

- A compliant host MUST differentiate MCP‑level and tool‑level errors in its UX and logs.
- The host MUST NOT treat a single tool‑level error as a fatal MCP connection failure.


7.2. Timeouts and Retries
-------------------------

Hosts typically enforce timeouts (e.g., 90 seconds) for MCP requests.

Eligibility criteria:

- On timeout:
  - The host SHOULD mark the request as failed with a timeout error.
  - The host MAY restart TAQWIN if it suspects the process is stuck.
- If the host restarts TAQWIN:
  - It MUST treat the new process as a fresh session.
  - It MUST re‑run `initialize`.
  - It MUST re‑discover tools if needed.


7.3. Invalid Traffic and `invalid_union`‑type Diagnostics
---------------------------------------------------------

Some hosts perform schema validation of server messages and log errors like:

- `"code": "invalid_union"`, `"expected": "string"`, `"expected": "number"`, or `"unrecognized_keys": [...]`

These are **host‑side validations**, not TAQWIN errors.

Eligibility criteria:

- A compliant host SHOULD:
  - Validate envelopes strictly enough to avoid mis‑routing messages.
  - But MUST NOT treat benign schema mismatches as fatal if the message is otherwise usable.
- When the host rejects a message due to schema issues, it MUST:
  - Log the full offending message for diagnosis.
  - Avoid sending further requests based on a corrupted state.

----------------------------------------------------------------------
8. Logging and Observability
----------------------------------------------------------------------

8.1. Host‑Side Logging
----------------------

A robust host SHOULD log:

- Process start/stop events (PID, command, cwd).
- Each request:
  - Direction: outbound (to TAQWIN).
  - `id`, `method`, truncated `params`.
- Each response:
  - Direction: inbound (from TAQWIN).
  - `id`, presence of `result` or `error`.
  - Summaries of tool output (status, error).
- Timeouts and retries.
- Fatal errors and reasons for restart.

Eligibility criteria:

- A compliant host MUST provide enough logging to allow correlation with TAQWIN’s own `mcp_traffic.jsonl` logs during incident analysis.


8.2. TAQWIN‑Side Logging
------------------------

TAQWIN logs MCP traffic to:

- `data/logs/mcp_traffic.jsonl`

Each entry contains:

- `ts`: timestamp
- `event`: `server_start`, `request`, `response`, etc.
- `direction`: `inbound` or `outbound`
- `meta`: context (id, method)
- `payload`: parsed JSON object
- `raw`: original line (for requests when available)

Host developers SHOULD:

- Use these logs to validate their integration.
- Compare host’s notion of sent/received messages with TAQWIN’s record.

----------------------------------------------------------------------
9. Example Host Behaviors
----------------------------------------------------------------------

This section describes example sequences of well‑behaved host interactions with TAQWIN.

9.1. Minimal Happy Path (Line JSON)
-----------------------------------

1. Host starts TAQWIN with correct command, cwd, and environment.
2. Host sends `initialize` as a single JSON line.
3. TAQWIN responds with `initialize` result as a single JSON line.
4. Host sends `tools/list` as a single JSON line.
5. TAQWIN responds with tool catalog as a single JSON line.
6. Host sends one or more `tools/call` requests as single JSON lines.
7. TAQWIN responds with content for each call.
8. Host eventually sends no more requests; TAQWIN exits or is terminated gracefully.


9.2. Minimal Happy Path (Content‑Length)
---------------------------------------

1. Host starts TAQWIN.
2. Host sends `initialize` using Content‑Length framing.
3. TAQWIN auto‑detects Content‑Length and responds the same way.
4. Host continues sending all subsequent requests with Content‑Length framing.
5. TAQWIN responds with matching Content‑Length framing for all responses.


9.3. Robust Tool Usage with Error Handling
------------------------------------------

1. Host calls `tools/list` and caches the result.
2. Host lets the user pick a tool; for example, `scan_database`.
3. Host constructs `arguments` according to the tool’s `inputSchema`.
4. Host calls `tools/call`.
5. If the result’s `content[0].text` contains `"status": "ERROR"`:
   - Host surfaces the error reason to the user.
   - Host allows the user to retry with adjusted arguments.
6. If the MCP envelope itself contains `error`:
   - Host logs MCP‑level error details.
   - Host may choose to retry or prompt the user to restart MCP.

----------------------------------------------------------------------
10. Eligibility Checklist
----------------------------------------------------------------------

This section provides a concise checklist for determining whether an MCP host is **eligible** and **fully compatible** with TAQWIN V1 MCP.

10.1. Process Launch
--------------------

- [ ] Uses an absolute Python 3.11+ interpreter path.
- [ ] Uses `-u` and an absolute path to `main.py`.
- [ ] Sets `cwd` to the TAQWIN repo root.
- [ ] Sets `PYTHONUNBUFFERED = "1"`.


10.2. Framing
-------------

- [ ] Chooses either line JSON or Content‑Length framing consistently.
- [ ] Sends the first request using the intended framing mode.
- [ ] Correctly parses responses using the negotiated mode.
- [ ] Does not mix raw Content‑Length headers with line JSON.


10.3. JSON‑RPC
--------------

- [ ] All requests include `"jsonrpc": "2.0"`, string/number `id`, string `method`.
- [ ] All `params` are objects.
- [ ] The host can handle both `result` and `error` envelopes.
- [ ] The host routes responses to the right caller using `id`.


10.4. MCP Methods
-----------------

- [ ] Sends `initialize` first and waits for the response.
- [ ] Calls `tools/list` after successful `initialize`.
- [ ] Uses `tools/call` only with valid `params.name` and object `params.arguments`.


10.5. Error Handling
--------------------

- [ ] Distinguishes MCP‑level errors from tool‑level failures.
- [ ] Treats timeouts as recoverable and can restart TAQWIN cleanly.
- [ ] Logs enough information to diagnose issues with TAQWIN logs.


10.6. Practical Usage
---------------------

- [ ] Can successfully:
  - Initialize.
  - List tools.
  - Call at least:
    - `get_server_status`
    - `debug_test`
    - `scan_database` (e.g., `scan_overview` and `execute_query`).
    - `web_intelligence` (basic query).

If all checklist items are satisfied and the sequences in Section 9 succeed against a real TAQWIN instance, the MCP host is considered **eligible**, **compatible**, and **production‑ready** for TAQWIN V1 MCP.

