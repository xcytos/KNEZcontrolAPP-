# TAQWIN Learnings

**Purpose:** Extract learnings from mistakes to improve system behavior and prevent recurrence  
**Domain:** development  
**Created:** 2026-04-12  
**Status:** ACTIVE

---

## LEARNING-001: Central Identity is Critical for System Activation

### Source Mistake
MISTAKE-001: No Central Identity File

### Learning
Every system must have a central identity + activation file. Identity must be consolidated before activation. Activation mechanism must be explicitly defined and documented.

### Rule
- **RULE-001:** Every system must have a central identity + activation file
- **RULE-002:** Identity must be consolidated before system activation
- **RULE-003:** Activation mechanism must be explicitly documented

### Application
- Always create central identity file before system activation
- Consolidate scattered identity files into single file
- Define activation checklist and state tracking
- Verify identity consolidation before activation

### Impact
Prevents fragmented identity, enables system activation, provides clear activation mechanism

---

## LEARNING-002: Structure Must Match Specification

### Source Mistake
MISTAKE-002: Memory Structure Mismatch

### Learning
Structure must match target specification. Domain separation is required for scalability. Validation against target specification is mandatory before implementation.

### Rule
- **RULE-004:** Memory structure must match target specification
- **RULE-005:** Domain separation is required for memory systems
- **RULE-006:** Validate structure against specification before implementation

### Application
- Always read target specification before implementation
- Validate structure against specification during implementation
- Create domain-separated structure for memory systems
- Update documentation when structure changes

### Impact
Prevents structure mismatches, enables scalability, ensures specification compliance

---

## LEARNING-003: Empty Directories Are Misleading

### Source Mistake
MISTAKE-003: Empty Directories Implied Capability

### Learning
Do not create empty directories without implementation. If functionality is planned, document as PLANNED. Remove empty directories or implement functionality.

### Rule
- **RULE-007:** Do not create empty directories without implementation
- **RULE-008:** If functionality is planned, document as PLANNED
- **RULE-009:** Remove empty directories or implement functionality

### Application
- Never create empty directories
- If planning functionality, create PLANNED documentation
- Either implement functionality or remove directory
- Add status indicators to directory documentation

### Impact
Prevents misleading structure, ensures implementation matches documentation, manages expectations

---

## LEARNING-004: Documentation Must Match Implementation

### Source Mistake
MISTAKE-004: Memory Mesh Was Static, Not Dynamic

### Learning
Documentation must match implementation. If graph is claimed, graph logic must be implemented. Static markdown is not a graph system.

### Rule
- **RULE-010:** Documentation must match implementation
- **RULE-011:** If graph is claimed, graph logic must be implemented
- **RULE-012:** Static markdown is not a graph system

### Application
- Never claim functionality without implementation
- If claiming graph system, implement graph logic
- Distinguish between documentation and implementation
- Reclassify systems if implementation doesn't match claims

### Impact
Prevents false claims, ensures documentation accuracy, manages expectations

---

## LEARNING-005: History Requires Diff Tracking

### Source Mistake
MISTAKE-005: History System Was Audit Documentation, Not Functional History

### Learning
History requires diff tracking to be functional. Change reconstruction is critical for history systems. Timeline and version linking are mandatory.

### Rule
- **RULE-013:** History requires diff tracking to be functional
- **RULE-014:** Change reconstruction is critical for history systems
- **RULE-015:** Timeline and version linking are mandatory

### Application
- Implement diff tracking for history systems
- Enable change reconstruction from history
- Create timeline of changes
- Link versions for rollback capability

### Impact
Enables functional history, allows change reconstruction, provides rollback capability

---

## LEARNING-006: Single Source of Truth for State

### Source Mistake
MISTAKE-006: No Runtime State Tracking

### Learning
Single source of truth is critical for runtime state. State must be centralized, not scattered. Runtime state tracking is mandatory for system management.

### Rule
- **RULE-016:** Single source of truth is critical for runtime state
- **RULE-017:** State must be centralized, not scattered
- **RULE-018:** Runtime state tracking is mandatory

### Application
- Create single runtime state file
- Centralize all state information
- Define state categories and update mechanism
- Track state evolution over time

### Impact
Enables state tracking, provides single source of truth, supports state management

---

## LEARNING-007: System Map is Critical for Navigation

### Source Mistake
MISTAKE-007: No System Map Documentation

### Learning
System map is critical for navigation. Memory domains must be documented. Access patterns must be defined.

### Rule
- **RULE-019:** System map is critical for navigation
- **RULE-020:** Memory domains must be documented
- **RULE-021:** Access patterns must be defined

### Application
- Create system map for all systems
- Document all memory domains with purpose
- Define access patterns for each domain
- Define relationships between domains

### Impact
Enables systematic navigation, provides domain documentation, defines access patterns

---

## LEARNING-008: Baseline is Critical for Evolution

### Source Mistake
MISTAKE-008: No Initial State Baseline

### Learning
Baseline is critical for measuring evolution. Initial state must be documented. Evolution tracking requires reference point.

### Rule
- **RULE-022:** Baseline is critical for measuring evolution
- **RULE-023:** Initial state must be documented
- **RULE-024:** Evolution tracking requires reference point

### Application
- Create initial state baseline before any changes
- Document complete directory structure
- Document file inventory with sizes
- Calculate baseline metrics

### Impact
Enables evolution measurement, provides reference point, supports change tracking

---

## LEARNING-009: Pre-Execution Mistake Review

### Source Learning
TAQWIN ENGINE-002 implementation

### Learning
Before any execution, must read mistakes.md and learnings.md. This prevents recurrence of known mistakes and ensures application of learned rules.

### Rule
- **RULE-025:** Pre-execution mistake review is mandatory
- **RULE-026:** Read mistakes.md before execution
- **RULE-027:** Read learnings.md before execution
- **RULE-028:** Apply learned rules during execution

### Application
- Add mistake review to activation loop
- Require mistake review before ticket execution
- Check for relevant mistakes before action
- Apply learned rules to prevent recurrence

### Impact
Prevents mistake recurrence, ensures learning application, improves execution quality

---

## LEARNING-010: Serialized Execution is Mandatory

### Source Learning
TAQWIN ENGINE-002 implementation

### Learning
Every action must follow serialized execution: Ticket → Execution → Memory → History → Link all. Nothing without trace. If something happens and is not recorded, it does not exist.

### Rule
- **RULE-029:** Serialized execution is mandatory
- **RULE-030:** Every action must be recorded
- **RULE-031:** Nothing without trace
- **RULE-032:** If not recorded, it does not exist

### Application
- Create ticket before any execution
- Record execution in history
- Update memory after execution
- Link all related items
- Verify trace completeness

### Impact
Ensures traceability, enables reproducibility, provides audit trail

---

## LEARNING-011: Node.js Modules Require Node.js Environment

### Source Mistake
MISTAKE-009: Native Node.js Modules in Browser/Tauri Environment

### Learning
Native Node.js modules (better-sqlite3, fs, crypto) do not work in browser/Tauri environment. Must use Tauri plugins (@tauri-apps/plugin-*) or browser APIs for native functionality. Database operations must move to Rust backend or use browser-compatible storage. Vite configuration must externalize Node.js modules for browser builds.

### Rule
- **RULE-033:** Native Node.js modules cannot be used in Tauri/browser environment
- **RULE-034:** Use Tauri plugins (@tauri-apps/plugin-*) for native functionality
- **RULE-035:** Database operations must be in Rust backend, not frontend
- **RULE-036:** Externalize Node.js modules in Vite config for browser builds

### Application
- Check if module is native Node.js before using in Tauri app
- Use @tauri-apps/plugin-fs for file system access
- Use @tauri-apps/plugin-shell for shell commands
- Move database operations to Rust backend
- Configure Vite aliases for native modules to stubs
- Use Web Crypto API instead of Node.js crypto

### Impact
Prevents runtime errors, enables browser compatibility, ensures proper use of Tauri APIs

---

## LEARNING-012: File System Access Requires Native APIs

### Source Mistake
MISTAKE-010: File System Module (fs) in Browser Environment

### Learning
Node.js fs module does not work in browser/Tauri environment. File watching requires native file system APIs or Tauri plugins. File-based memory injection not suitable for browser/Tauri environment. Memory injection should use API endpoints or Rust backend. Services must be designed for target environment (Node.js vs browser).

### Rule
- **RULE-037:** Node.js fs module cannot be used in Tauri/browser environment
- **RULE-038:** File watching requires Tauri plugins or Rust backend
- **RULE-039:** Memory injection should use API endpoints, not file watching
- **RULE-040:** Services must be designed for target environment (Node.js vs browser)

### Application
- Design services for target environment (Node.js vs browser)
- Use @tauri-apps/plugin-fs for file operations in Tauri
- Implement file watching in Rust backend
- Use API endpoints for memory injection
- Separate Node.js-only services (tests) from browser services
- Document environment compatibility for each service

### Impact
Prevents runtime errors, enables proper file access, ensures environment compatibility

---

## SUMMARY

### Total Learnings: 12

### Learning Categories:
- Identity/Activation: 1
- Structure/Organization: 2
- Documentation/Implementation: 2
- State Tracking: 2
- Execution Process: 3
- Environment Compatibility: 2

### Rules Derived: 40

### Application Status
- Pre-execution review: ENABLED
- Rule enforcement: ENABLED
- Serialized execution: ENABLED

### Impact
Prevents mistake recurrence, improves execution quality, ensures traceability

---

## PRE-EXECUTION CHECKLIST

Before any execution:

- [ ] Read .taqwin/taqwin.md (identity activation)
- [ ] Read .taqwin/memory/development/mistakes.md
- [ ] Read .taqwin/memory/development/learnings.md
- [ ] Check for relevant mistakes
- [ ] Apply relevant rules
- [ ] Create ticket if not exists
- [ ] Execute serialized process
- [ ] Record in history
- [ ] Update memory
- [ ] Link all items

---

**END OF LEARNINGS**
