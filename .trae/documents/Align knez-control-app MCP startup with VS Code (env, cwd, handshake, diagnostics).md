# First: What VSCode Actually Does (Architecturally)

&#x20;

VSCode MCP host is:

1. **Single runtime authority**
2. **Strict handshake state machine**
3. **Phase-gated tool execution**
4. **Environment-complete spawn**
5. **Server-scoped logging**
6. **Non-silent JSON-RPC compliance**
7. **Session-stable transport**
8. **Never mixes runtime generations**
9. **Treats stderr as informational**
10. **Rejects pending requests on lifecycle transitions**

Your app currently partially does these.

To be VSCode-level, you must enforce all 10.

***

# 🧠 Core Architectural Decision (Non-Negotiable)

## 🔥 Choose One Runtime Authority

Right now you have:

* TS STDIO client
* Rust MCP host runtime

That is architectural ambiguity.

You must choose:

> In Tauri desktop builds → Rust is the only process authority\
> TS clients become pure UI adapters

If you keep both active, you will never get deterministic behavior.

**FINAL DECISION: Rust owns lifecycle + JSON-RPC.**

TS layer:

* Only calls Rust commands.
* Does not spawn.
* Does not manage pending map.
* Does not parse stdout.

This alone eliminates half of your flakiness.

***

# 🏗 Final Production Architecture

```
React UI
    ↓ invoke()
Tauri Commands
    ↓
Rust MCP Host Runtime (Single Authority)
    ↓ spawn + stdio pipes
MCP Server Process

```

All JSON-RPC happens inside Rust.

TS only displays state.

***

# 🔒 Phase 1 — Deterministic Handshake State Machine

You must implement an explicit handshake state machine in Rust.

### Allowed states:

```
IDLE
SPAWNING
INITIALIZING
INITIALIZED
DISCOVERING
READY
STOPPING
STOPPED
ERROR

```

### Strict transitions:

```
IDLE → SPAWNING
SPAWNING → INITIALIZING
INITIALIZING → INITIALIZED
INITIALIZED → DISCOVERING
DISCOVERING → READY
READY → STOPPING
STOPPING → STOPPED

```

Forbidden:

* Duplicate initialize
* tools/call before READY
* tools/list before INITIALIZED

Any violation → explicit protocol error.

***

# 🔄 Phase 2 — Strict JSON-RPC Contract

For every request sent:

* It must be recorded in pending map
* It must resolve OR reject
* It must never silently disappear

### Required behavior:

If server:

* Sends unknown id → log unsolicited\_response
* Sends invalid JSON → classify framing\_error
* Does not respond → classify phase-specific timeout

Timeout classification must be:

```
mcp_timeout_initialize
mcp_timeout_tools_list
mcp_timeout_tools_call
mcp_timeout_shutdown

```

Never generic `mcp_request_timeout`.

***

# 🧪 Phase 3 — VSCode-Level Spawn Fidelity

VSCode spawn behavior must be replicated exactly.

### 1. Full env inheritance

In Rust:

```
let mut env: HashMap<String, String> = std::env::vars().collect();
overlay(config.env);

```

Never spawn with partial env.

***

### 2. Stable cwd

If config.cwd missing:

```
dirs::home_dir()

```

Never allow implicit cwd.

***

### 3. Windows encoding detection

On Windows:

```
cmd /c chcp

```

Detect active code page.

Use correct decoding for stdout.

This prevents subtle framing corruption.

***

### 4. npx reliability

For npx servers:

* Always pass inherited PATH
* Ensure `SystemRoot`, `ComSpec`
* Add `NPM_CONFIG_REGISTRY` if missing
* Extend initialize timeout to 45s for first install

***

# 🛡 Phase 4 — Lifecycle Isolation (Generation IDs)

This is CRITICAL.

Every spawn gets:

```
generation_id: u64

```

Every pending request stores generation.

If process exits:

* All pending requests for that generation are rejected immediately.

No timeout should occur after stop.

This eliminates ghost timeouts and `pid:null` confusion.

***

# 📊 Phase 5 — Structured Logging (VSCode-Level Clarity)

Every log entry must include:

```
{
  serverId,
  pid,
  generation,
  authority: "rust",
  phase,
  method,
  id,
  framing,
  protocolVersion
}

```

Never log without serverId.

Never log without generation.

***

# 📦 Phase 6 — Enforce MCP Spec Compliance (Server Side)

TAQWIN must:

* Respond to every request
* Return error for unknown methods
* Never silently ignore

Add fallback handler:

```
if method not handled:
    return jsonrpc_error(-32601, "Method not found")

```

Without this, your host will always time out.

***

# 🔍 Phase 7 — Framing Lock Rules

Framing rules must be:

1. Try content-length first.
2. If initialize fails → restart process → try line mode.
3. Once first write happens → framing locked.
4. Never change framing mid-session.

This must live in Rust only.

***

# 🚦 Phase 8 — Inspector UX = VSCode Behavior

Your “Start” must do:

```
spawn
initialize
notifications/initialized
tools/list
→ READY

```

User should never manually initialize.

READY must require:

```
tools.length > 0

```

Else error:

```
mcp_server_no_tools

```

***

# 🧬 Phase 9 — Pending Map Hard Guarantees

For each pending request:

Store:

```
id
method
phase
generation
created_at
pid

```

On stop:

* reject all pending
* clear map
* log pending\_leak\_detected if not empty

***

# 🔧 Phase 10 — Chrome DevTools MCP Preset

Preset config:

```
{
  command: "npx",
  args: [
    "-y",
    "chrome-devtools-mcp@latest",
    "--no-usage-statistics"
  ]
}

```

Add help text for:

* Node >= 18 required
* First install may take time

***

# 🧪 Phase 11 — Automated Validation Matrix

You must test:

Server

Type

Expected

TAQWIN

Python STDIO

READY

chrome-devtools-mcp

npx STDIO

READY

server-puppeteer

npx STDIO

READY

HTTP SSE MCP

HTTP

READY

Zero-tools test server

STDIO

explicit no\_tools error

***

# 🔒 Phase 12 — Remove TS STDIO Client in Desktop Mode

TS layer must not:

* spawn
* parse JSON-RPC
* manage pending

It must:

```
invoke("mcp_request")
invoke("mcp_start")
invoke("mcp_stop")

```

Everything else Rust.

***

# 📈 Final Expected Behavior

After implementation:

Chrome DevTools MCP:

```
MCP process started
MCP initialize ok
MCP notify initialized
MCP tools/list ok (25 tools)
STATE: READY

```

TAQWIN:

```
MCP initialize ok
MCP tools/list ok (7 tools)
STATE: READY

```

No:

* duplicate initialize
* pid:null timeouts
* cross-server contamination
* silent drops
* framing flips
* ghost shutdown timeouts

***

# 🧠 Final Verdict On Your Proposed Plan

Your plan:

* Fix env
* Improve handshake
* Improve logs

That is maybe 30% of the solution.

The full solution requires:

* Runtime authority unification
* Deterministic state machine
* Generation isolation
* Strict JSON-RPC compliance
* Server contract enforcement
* Spawn fidelity
* Pending lifecycle guarantees

***

# 🎯 Bottom Line

If you implement all 12 phases above:

Your knez-control-app will behave indistinguishably from VSCode / Trae.

Not “close”.

Indistinguishable.
