# KNEZ Architecture - Mental Models

## Mental Model 1: Layered Architecture as a Building

**Concept:** Think of KNEZ as a 10-story building, where each floor represents a layer.

**Visualization:**
```
┌─────────────────────────────────┐
│ Floor 10: Observability        │ ← Roof deck (view of everything)
├─────────────────────────────────┤
│ Floor 9: Governance            │ ← Security office (policies, approvals)
├─────────────────────────────────┤
│ Floor 8: Cognitive              │ ← Brain (intelligence, context)
├─────────────────────────────────┤
│ Floor 7: Infrastructure         │ ← Building systems (power, water)
├─────────────────────────────────┤
│ Floor 6: MCP Integration        │ ← Loading dock (external connections)
├─────────────────────────────────┤
│ Floor 5: Tool Execution         │ ← Workshop (tools, equipment)
├─────────────────────────────────┤
│ Floor 4: Agent Runtime          │ ← Manager (orchestration, decisions)
├─────────────────────────────────┤
│ Floor 3: Chat & Communication    │ ← Reception (user interaction)
├─────────────────────────────────┤
│ Floor 2: Memory & Knowledge     │ ← Library (information storage)
├─────────────────────────────────┤
│ Floor 1: Data Processing        │ ← Foundation (persistence, storage)
└─────────────────────────────────┘
```

**Key Insights:**
- Higher floors depend on lower floors (foundation first)
- Each floor has a specific purpose
- Elevators (data flow) connect floors
- Observability at top provides view of entire building

---

## Mental Model 2: Agent as a Loop with Decision Points

**Concept:** Think of the agent as a continuous loop with decision points at each iteration.

**Visualization:**
```
┌─────────────┐
│ Start Loop  │
└──────┬──────┘
       │
       ▼
┌─────────────┐    ┌──────────────┐
│ Intent Det.  │───►│ Direct Tool? │──Yes─► Execute Tool
└──────┬──────┘    └──────────────┘
       │ No
       ▼
┌─────────────┐
│ Call Model  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Parse Tool  │
└──────┬──────┘
       │
       ▼
┌─────────────┐    ┌──────────────┐
│ Security    │───►│ Blocked?     │──Yes─► Stop
└──────┬──────┘    └──────────────┘
       │ No
       ▼
┌─────────────┐
│ Execute Tool│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Normalize   │
└──────┬──────┘
       │
       ▼
┌─────────────┐    ┌──────────────┐
│ Update Ctx  │───►│ Stop Cond.?  │──Yes─► Final Answer
└──────┬──────┘    └──────────────┘
       │ No
       │
       └──► Repeat
```

**Key Insights:**
- Multiple decision points in each iteration
- Early exit for direct tool calls (optimization)
- Security check before execution (safety)
- Context update drives next iteration
- Stop conditions prevent infinite loops

---

## Mental Model 3: Memory as Event Timeline

**Concept:** Think of memory as a timeline of events that can be replayed to reconstruct state.

**Visualization:**
```
Time →
─────────────────────────────────────────────────
│ MEMORY_CREATED │ MEMORY_TAGGED │ MEMORY_UPDATED │
│ (id: mem1)     │ (id: mem1)    │ (id: mem1)     │
─────────────────────────────────────────────────
│ MEMORY_CREATED │ MEMORY_RELATED │ MEMORY_UPDATED │
│ (id: mem2)     │ (mem1 → mem2) │ (id: mem2)     │
─────────────────────────────────────────────────
│ MEMORY_CREATED │ MEMORY_TAGGED │                │
│ (id: mem3)     │ (id: mem3)    │                │
─────────────────────────────────────────────────
                  ▲
                  │ Replay to any point
                  │
          State at t2: {mem1, mem2}
          State at t3: {mem1, mem2, mem3}
```

**Key Insights:**
- Events are immutable (append-only)
- State is derived from events
- Can replay to any point in time
- Events enable temporal queries
- Complete audit trail

---

## Mental Model 4: MCP as Universal Plug System

**Concept:** Think of MCP as a universal plug system where tools are like appliances you can plug in.

**Visualization:**
```
┌─────────────────────────────────────────┐
│         KNEZ (Power Outlet)              │
│                                         │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│   │HTTP │ │Stdio│ │Rust │ │Built │     │
│   │Plug │ │Plug │ │Plug │ │-in  │     │
│   └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘     │
│      │       │       │       │        │
└──────┼───────┼───────┼───────┼────────┘
       │       │       │       │
    ┌──▼──┐ ┌─▼───┐ ┌─▼───┐ ┌─▼───┐
    │Web  │ │File │ │Native│ │Local│
    │Tools│ │Tools│ │Tools│ │Tools│
    └─────┘ └─────┘ └─────┘ └─────┘
```

**Key Insights:**
- Standardized plug (MCP protocol)
- Multiple plug types (HTTP, Stdio, Rust, Builtin)
- Tools are appliances (plug and play)
- Power outlet (KNEZ) provides energy (orchestration)
- Can hot-swap tools

---

## Mental Model 5: Cache as Water Tower System

**Concept:** Think of multi-level caching as a water tower system with tanks at different heights.

**Visualization:**
```
    ┌─────────┐
    │ L1 Tank │ ← Small, fast, rooftop (in-memory)
    │ (100L)  │   Immediate access
    └────┬────┘
         │ Gravity
         ▼
    ┌─────────┐
    │ L2 Tank │ ← Medium, medium speed, second floor (IndexedDB)
    │ (1000L) │   Short delay
    └────┬────┘
         │ Gravity
         ▼
    ┌─────────┐
    │ L3 Tank │ ← Large, slow, ground floor (SQLite)
    │ (10000L)│   Longer delay
    └────┬────┘
         │ Pump
         ▼
    ┌─────────┐
    │ Well    │ ← Source (database, API)
    │ (Unlimited)│ Slowest access
    └─────────┘
```

**Key Insights:**
- Check L1 first (fastest)
- If empty, check L2
- If empty, check L3
- If empty, pump from well
- Gravity (hierarchy) ensures optimal flow

---

## Mental Model 6: Observability as Control Room

**Concept:** Think of observability as a control room with monitors showing different system aspects.

**Visualization:**
```
┌─────────────────────────────────────────────────┐
│              OBSERVABILITY CONTROL ROOM           │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ Events  │ │ Logs    │ │ Metrics │         │
│  │ Monitor │ │ Monitor │ │ Monitor │         │
│  └─────────┘ └─────────┘ └─────────┘         │
│                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ Debug   │ │ Errors  │ │ Perf    │         │
│  │ Panel   │ │ Class   │ │ Graph   │         │
│  └─────────┘ └─────────┘ └─────────┘         │
│                                                 │
│  ┌─────────────────────────────────────┐     │
│  │     Execution Graph Visualization     │     │
│  └─────────────────────────────────────┘     │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Key Insights:**
- Multiple monitors for different aspects
- Real-time visibility into system
- Centralized location for monitoring
- Different views for different stakeholders
- Alerts when things go wrong

---

## Mental Model 7: Governance as Traffic Control

**Concept:** Think of governance as traffic control with rules, checkpoints, and enforcement.

**Visualization:**
```
┌─────────────────────────────────────────────────┐
│              GOVERNANCE TRAFFIC CONTROL           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Tool Request                                   │
│       │                                         │
│       ▼                                         │
│  ┌─────────┐                                    │
│  │ Checkpoint 1: Permission Check             │
│  │ "Is this tool allowed?"                     │
│  └────┬────┘                                    │
│       │ Yes                                     │
│       ▼                                         │
│  ┌─────────┐                                    │
│  │ Checkpoint 2: Approval Required?            │
│  │ "Does this need human approval?"            │
│  └────┬────┘                                    │
│       │ No                                      │
│       ▼                                         │
│  ┌─────────┐                                    │
│  │ Checkpoint 3: Policy Validation             │
│  │ "Does this comply with policies?"           │
│  └────┬────┘                                    │
│       │ Yes                                     │
│       ▼                                         │
│  Tool Execution ✓                               │
│                                                 │
│  Audit Log: [Checkpoint 1: PASS]                 │
│              [Checkpoint 2: N/A]                │
│              [Checkpoint 3: PASS]               │
└─────────────────────────────────────────────────┘
```

**Key Insights:**
- Multiple checkpoints for different rules
- Approval required for sensitive operations
- Audit trail for compliance
- Rules can be configured
- Traffic can be stopped at any checkpoint

---

## Mental Model 8: Context Compression as Suitcase Packing

**Concept:** Think of context compression as packing a suitcase efficiently for travel.

**Visualization:**
```
Original Context (Full Suitcase):
┌─────────────────────────────────┐
│ All items (unorganized)          │
│ - Old clothes                    │
│ - Duplicate items                │
│ - Unnecessary items              │
│ - Heavy items                    │
└─────────────────────────────────┘
         │
         ▼ Compression
┌─────────────────────────────────┐
│ Packed Suitcase (Optimized)     │
│ - Essential items only           │
│ - Rolled clothes (compact)       │
│ - No duplicates                  │
│ - Light items prioritized        │
│ - Organized by category          │
└─────────────────────────────────┘
         │
         ▼
Travel Cost: Lower (lighter luggage)
Travel Speed: Faster (less weight)
Arrival Quality: Same (essentials preserved)
```

**Key Insights:**
- Remove unnecessary items (redundancy)
- Organize efficiently (structure)
- Prioritize essentials (relevance)
- Reduce weight (tokens)
- Maintain quality (information)

---

## Mental Model 9: Retry Strategy as GPS Rerouting

**Concept:** Think of retry strategy as GPS rerouting when you hit traffic or roadblocks.

**Visualization:**
```
Original Route:
Start → [Road A] → [Road B] → Destination
              ▲
              │ Roadblock!
              │
              ▼
GPS Rerouting:
- Analyze failure type (roadblock, traffic, construction)
- Find alternative routes (Road C, Road D)
- Calculate delay (how much longer)
- Refine route (take faster alternative)
- Try again

Retry Strategy:
- Classify failure (timeout, selector_not_found, etc.)
- Determine if retry is possible
- Calculate delay (exponential backoff)
- Refine arguments (fix the issue)
- Try again
```

**Key Insights:**
- Failure classification determines strategy
- Not all failures are retryable
- Delays prevent overwhelming the system
- Argument refinement fixes common issues
- Multiple attempts with increasing caution

---

## Mental Model 10: Drift Detection as Compass Navigation

**Concept:** Think of drift detection as compass navigation to stay on course.

**Visualization:**
```
Intended Course (North):
         ↑
         │
         │
    ┌────┴────┐
    │         │
    │  Agent  │
    │         │
    └─────────┘

Drift Detection:
- Scope Drift: Going East/West (task expansion)
- Rule Drift: Going off-road (rule violation)
- Focus Drift: Wandering (loss of focus)

Compass Readings:
┌─────────────────────────────────┐
│ Scope:  15° East  ⚠️           │
│ Rule:   On course ✓              │
│ Focus:  5° West   ⚠️           │
└─────────────────────────────────┘

Correction:
- Turn West to correct scope drift
- Stay on road to maintain rules
- Turn East to correct focus drift
```

**Key Insights:**
- Monitor three dimensions (scope, rule, focus)
- Detect deviations early
- Provide actionable corrections
- Prevent getting lost
- Maintain intended course
