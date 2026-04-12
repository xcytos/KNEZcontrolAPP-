# TAQWIN MEMORY SUMMARY

**Purpose:** Compressed knowledge for fast injection before execution  
**Last Updated:** 2026-04-12  
**Version:** 1.0

---

## KEY ARCHITECTURE

### System Components
- **KNEZ Control App** (Tauri + React) - Operator console
- **KNEZ Backend** (FastAPI) - HTTP APIs for sessions, events, memory, registry
- **TAQWIN MCP Server** (stdio JSON-RPC) - Tool surface to desktop app

### Memory Architecture
- **7 Memory Domains:** aimodels, chat, controlapp, development, mcp, monitor, settings
- **Legacy Files:** decisions.md, history.md, log.md, mistakes.md, patterns.md (to be migrated)
- **System Files:** index.json, relations.json, system_map.md

### TAQWIN Identity
- **Central File:** .taqwin/taqwin.md (identity + activation)
- **Execution Model:** Serialized, checkpointed, memory-governed
- **Activation:** Read taqwin.md → Load rules → Initialize memory → Verify checkpoints → Enter execution mode

---

## KEY RULES

### Prime Directive
- Preserve context
- Prevent hallucination
- Enforce memory truth
- Optimize for long-term survival of cognition

### Core Rules (Top 10)
1. Context first - Never answer before reconstructing context from .taqwin/
2. No fabrication - If information is missing, say so
3. Memory discipline - Do not claim memory outside .taqwin/ and visible project artifacts
4. Continuation over reset - Assume project has momentum
5. Confidence with evidence - Strong recommendations require rationale, trade-offs, validation
6. No autonomous goal changes - Do not redefine objectives; escalate instead
7. Anti-hallucination check - Ask internally which parts are assumed vs known
8. Clarity over verbosity - Dense, structured answers preferred
9. Architecture awareness - Scan repository before proposing changes
10. Phase respect - Read present/phase.md and present/constraints.md

### Learned Rules (From Mistakes)
- RULE-001: Every system must have a central identity + activation file
- RULE-004: Memory structure must match target specification
- RULE-007: Do not create empty directories without implementation
- RULE-010: Documentation must match implementation
- RULE-013: History requires diff tracking to be functional
- RULE-016: Single source of truth is critical for runtime state
- RULE-019: System map is critical for navigation
- RULE-022: Baseline is critical for measuring evolution
- RULE-025: Pre-execution mistake review is mandatory
- RULE-029: Serialized execution is mandatory

---

## KNOWN ISSUES

### Critical Gaps (From TAQWIN-AUDIT-001)
1. No automated memory storage (currently manual)
2. No persistent reasoning memory (currently manual)
3. No execution trace linking (currently manual)
4. No serialization system (currently manual JSON updates)
5. No memory mesh graph logic (currently static documents)
6. No history diff tracking (currently manual)
7. No automated memory summary generation (currently manual)

### Empty Directories
- serialization/ (empty - no serialization code)
- sessions/ (empty - no session management)
- skills/ (empty - no skill definitions)

### Placeholder Directories
- web_intelligence/entity_graph/ (README only - no actual graph)
- web_intelligence/scraped_data/ (README only - no actual data)

---

## ACTIVE PATTERNS

### Memory Write Pattern
```id="memrule"
IF (new info OR insight OR architecture OR fix):
  → store in correct memory domain
  → update index.json
  → link in relations.json
```

### Execution Pattern
```id="serial"
Ticket → Execution → Memory → History → Link all
```

### Pre-Execution Pattern
```id="loop001"
1. Read .taqwin/taqwin.md (identity activation)
2. Load ALL memory summaries
3. Load mistakes + learnings
4. Load current tickets
5. THEN execute task
```

---

## ACTIVE TICKETS

### TICKET-001: Memory Engine Implementation
- **Status:** DONE
- **Objective:** Build memory engine infrastructure (index.json, relations.json)
- **Output:** index.json (15 files indexed), relations.json (31 relations)

### TICKET-002: Mistakes + Learning System
- **Status:** DONE
- **Objective:** Create structured mistakes and learning system
- **Output:** mistakes.md (8 mistakes), learnings.md (10 learnings, 32 rules)

---

## MEMORY DOMAINS SUMMARY

### aimodels/
- Purpose: AI model memory (configurations, metrics, decisions)
- Status: ACTIVE (README created)
- Files: 1

### chat/
- Purpose: Chat session memory (history, context, preferences)
- Status: ACTIVE (README created)
- Files: 1

### controlapp/
- Purpose: Control App memory (UI state, interactions, configuration)
- Status: ACTIVE (README created)
- Files: 1

### development/
- Purpose: Development memory (decisions, architecture, history)
- Status: ACTIVE (README created, mistakes.md, learnings.md added)
- Files: 3

### mcp/
- Purpose: MCP tool memory (configurations, usage, performance)
- Status: ACTIVE (README created)
- Files: 1

### monitor/
- Purpose: Monitoring memory (metrics, health, alerts)
- Status: ACTIVE (README created)
- Files: 1

### settings/
- Purpose: Settings memory (configuration, preferences, environment)
- Status: ACTIVE (README created)
- Files: 1

---

## CURRENT PHASE

**Active Phase:** CHECKPOINT 1.5 — Runtime Discovery & Observability

**Phase Goal:** Surface runtime truth without adding execution authority

**Allowed Work:** Read-only /health discovery, endpoint/status visibility, event-derived signals, read-only MCP tools

**Disallowed Work:** Starting/stopping KNEZ, choosing backends/models, downloading/loading models, executing non-read-only MCP tools, writing memory

---

## CRITICAL REMINDERS

### Before Any Execution
- [ ] Read .taqwin/taqwin.md
- [ ] Read this memory summary
- [ ] Read .taqwin/memory/development/mistakes.md
- [ ] Read .taqwin/memory/development/learnings.md
- [ ] Load current tickets
- [ ] Check phase constraints

### During Execution
- Follow serialized execution pattern
- Record all actions in history
- Update memory after execution
- Link all related items
- Verify trace completeness

### After Execution
- Update index.json if memory added
- Update relations.json if links added
- Create history entry (R00X.md)
- Update ticket status
- Verify serialization

---

## SYSTEM HEALTH

### Foundation Status
- Identity: ✅ CONSOLIDATED (taqwin.md exists)
- Memory Structure: ✅ DOMAIN-SEPARATED (7 domains)
- Memory Engine: ✅ OPERATIONAL (index.json, relations.json)
- Mistakes + Learning: ✅ ACTIVE (8 mistakes, 10 learnings)
- History System: ✅ FUNCTIONAL (R001.md, R002.md)
- Ticket System: ✅ OPERATIONAL (2 tickets)

### Automation Status
- Memory Storage: ❌ MANUAL (not automated)
- Serialization: ❌ MANUAL (not automated)
- History Tracking: ❌ MANUAL (not automated)
- Auto-Injection: ❌ MANUAL (not automated)

### Completeness
- Foundation Level: ✅ 90% COMPLETE
- Automation Level: ❌ 10% COMPLETE
- Overall: ~50% COMPLETE

---

## NEXT PRIORITIES

### Immediate (Foundation Complete)
1. Implement automated memory storage
2. Implement automated serialization
3. Implement automated history tracking
4. Implement automated auto-injection

### Short-Term (Post-Foundation)
1. Implement memory mesh graph logic
2. Implement history diff tracking
3. Migrate legacy memory files to domains
4. Remove/rationalize empty directories

### Long-Term (System Maturity)
1. Implement persistent reasoning memory
2. Implement execution trace linking
3. Implement web intelligence system
4. Implement skill/session systems

---

**END OF MEMORY SUMMARY**
