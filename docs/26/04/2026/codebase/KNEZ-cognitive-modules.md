# KNEZ Cognitive Modules Documentation

## Overview

KNEZ cognitive modules provide advanced AI capabilities including influence systems, governance, memory management, perception, and runbook generation. These modules enable controlled, observable, and auditable AI behavior.

## Cognitive API

**Location:** `KNEZ/knez/cognitive/api.py`

### Responsibilities
REST API endpoints for cognitive system state, governance, influence, and audit operations.

### Endpoints

#### State Endpoints
- **GET /state/overview**: Overall cognitive state
- **GET /state/governance**: Governance system state
- **GET /state/influence**: Influence system state
- **GET /state/stability**: Stability metrics
- **GET /state/taqwin**: TAQWIN system state

#### Audit Endpoints
- **GET /audit/consistency**: Consistency audit reports

#### Influence Endpoints
- **GET /operator/influence/contracts**: List influence contracts
- **GET /operator/influence/global**: Get global influence status
- **POST /operator/influence/global**: Set global influence
- **POST /operator/influence/domain**: Set domain influence
- **POST /operator/influence/contract**: Set contract influence
- **POST /influence/vote**: Submit influence vote

#### Approval Endpoints
- **GET /approvals/pending**: List pending approvals
- **POST /approvals/request**: Request approval
- **POST /approvals/{id}/decision**: Submit approval decision

#### Runbook Endpoints
- **GET /runbooks/{session_id}**: Get runbook for session

## Influence System

**Location:** `KNEZ/knez/cognitive/influence/`

### Responsibilities
Manage influence contracts that modify system behavior (routing, tool selection, parameters).

### Key Components

#### Contracts
**Location:** `contracts.py`

Influence contract storage and management.

**Contract Structure:**
```python
class InfluenceContract:
    influence_id: str
    iri_id: str
    domain: str  # "routing", "tool_selection", "parameters"
    influence_type: str
    scope: str
    max_weight: float
    no_override: bool
    reversible: bool
    approved_by: str
    timestamp: str
```

**Operations:**
- Create contract
- Get contracts by domain
- Update contract
- Delete contract

#### Routing Influence Adapter
**Location:** `contracts.py` (RoutingInfluenceAdapter)

Applies influence contracts to backend routing decisions.

**Workflow:**
1. Get contracts for routing domain
2. Filter by scope and applicability
3. Apply weights to backend scores
4. Respect kill switches
5. Return modified scores and trace

**Trace Structure:**
```python
class RoutingInfluenceTrace:
    influence_id: str
    baseline_candidates: List[str]
    baseline_selected: str
    final_candidates: List[str]
    final_selected: str
    max_weight: float
    applied_weight: float
    kill_switch_global_enabled: bool
    kill_switch_domains_disabled: List[str]
    kill_switch_influences_disabled: List[str]
```

#### Runtime Switches
**Location:** `contracts.py` (RuntimeSwitches)

Global, domain, and influence-level toggles.

**Switches:**
- **global_enabled**: Master switch for all influence
- **domains_disabled**: Disabled domains
- **influences_disabled**: Disabled specific influences

**Operations:**
- `enable_global(reason)`: Enable global influence
- `disable_global(reason)`: Disable global influence
- `enable_domain(domain, reason)`: Enable domain
- `disable_domain(domain, reason)`: Disable domain
- `enable_influence(id, reason)`: Enable influence
- `disable_influence(id, reason)`: Disable influence

### Influence Types

#### Routing Influence
Modifies backend selection scores.

**Use Cases:**
- Prefer specific backend for certain tasks
- Load balancing
- Cost optimization

#### Tool Selection Influence
Modifies tool selection.

**Use Cases:**
- Prefer specific tools
- Tool policy enforcement
- Security constraints

#### Parameter Influence
Modifies generation parameters.

**Use Cases:**
- Temperature adjustment
- Token limit adjustment
- Model selection

## Governance System

**Location:** `KNEZ/knez/cognitive/governance/`

### Responsibilities
Approval workflow, policy enforcement, and audit trails.

### Key Components

#### Approval Queue
**Location:** `approval/queue.py`

Manages pending and completed approvals.

**Approval Item:**
```python
class ApprovalItem:
    approval_id: str
    kind: str
    status: "pending" | "approved" | "denied"
    requested_at: str
    requested_by: str
    payload: Dict[str, Any]
    decided_at: Optional[str]
    decided_by: Optional[str]
    decision_reason: Optional[str]
```

**Operations:**
- `request(approval_id, kind, requested_by, payload)`: Request approval
- `list_pending(limit)`: List pending approvals
- `decide(approval_id, decision, actor, reason)`: Decide on approval

**Approval Kinds:**
- Tool execution
- Sensitive operation
- System change
- Data access

#### Policy Engine
**Location:** `policy/engine.py`

Evaluates policies against actions.

**Policy Types:**
- Tool usage policies
- Data access policies
- System change policies

**Operations:**
- `evaluate(action, context)`: Evaluate policy
- `check_compliance(action)`: Check compliance

#### Audit Logger
**Location:** `audit/logger.py`

Logs governance actions for audit trails.

**Audit Events:**
- Approval requests
- Approval decisions
- Policy violations
- System changes

## Memory System

**Location:** `KNEZ/knez/memory/`

### Responsibilities
Knowledge storage, retrieval, and hint generation for routing decisions.

### Key Components

#### Memory Storage
**Location:** `storage.py`

Database operations for memory entries.

**Memory Entry:**
```python
class MemoryEntry:
    memory_id: str
    session_id: str
    memory_type: str
    summary: str
    evidence_event_ids: List[str]
    confidence: float
    retention_policy: str
    created_at: str
```

**Memory Types:**
- **fact**: Factual information
- **preference**: User preferences
- **context**: Contextual information
- **pattern**: Observed patterns

**Operations:**
- `insert(memory)`: Insert memory
- `get(memory_id)`: Get memory by ID
- `query(session_id, filters)`: Query memories
- `delete(memory_id)`: Delete memory

#### Memory Hint Generator
**Location:** `consumption.py`

Generates hints for routing decisions based on memory.

**Hint Structure:**
```python
class MemoryHint:
    hint_type: str
    relevance: float
    suggestion: str
    evidence: List[str]
```

**Operations:**
- `generate_hints(session_id, decision_context, max_hints)`: Generate hints

**Decision Contexts:**
- `route_select`: Backend routing
- `tool_select`: Tool selection
- `parameter_select`: Parameter selection

#### Memory Gate
**Location:** `gate.py`

Controls memory access based on policies.

**Gate Check:**
```python
class GateCheck:
    allowed: bool
    reason: str
    policy_id: Optional[str]
```

**Operations:**
- `check_access(session_id, memory_type)`: Check access
- `grant_access(session_id, memory_type)`: Grant access
- `revoke_access(session_id, memory_type)`: Revoke access

## Perception System

**Location:** `KNEZ/knez/perception/`

### Responsibilities
System monitoring, active window detection, and screenshot capture.

### Key Components

#### Snapshot Manager
**Location:** `snapshot.py`

Captures system state snapshots.

**Snapshot Structure:**
```python
class PerceptionSnapshot:
    timestamp: str
    active_window: ActiveWindowInfo
    screen_regions: List[ScreenRegion]
    system_state: Dict[str, Any]
```

**Operations:**
- `take_snapshot()`: Take snapshot
- `get_snapshot(snapshot_id)`: Get snapshot
- `list_snapshots(session_id)`: List snapshots

#### Window Detector
**Location:** `window.py`

Detects active window information.

**Window Info:**
```python
class ActiveWindowInfo:
    title: str
    process_name: str
    bounds: Rect
    is_focused: bool
```

**Operations:**
- `get_active_window()`: Get active window
- `list_windows()`: List all windows
- `monitor_windows()`: Monitor window changes

#### State Monitor
**Location:** `monitor.py`

Monitors system state.

**State Metrics:**
- CPU usage
- Memory usage
- Disk usage
- Network activity

**Operations:**
- `get_system_state()`: Get system state
- `monitor_state()`: Start monitoring
- `stop_monitoring()`: Stop monitoring

## Runbook Generation

**Location:** `KNEZ/knez/cognitive/runbook.py`

### Responsibilities
Generates runbooks (summaries of decisions and actions) for sessions.

### Runbook Structure

```python
class Runbook:
    session_id: str
    timeline: List[TimelineEvent]
    key_decisions: List[Decision]
    rejected_actions: List[Action]
    why_no_action_was_taken: str
    safety_checks_passed: List[str]
    final_outcome: str
```

### Operations

#### generate_runbook(session_id)

Generates runbook for session.

**Workflow:**
1. Query events for session
2. Identify key decisions
3. Identify rejected actions
4. Extract safety checks
5. Summarize outcome
6. Return runbook

## Dashboard

**Location:** `KNEZ/knez/cognitive/dashboard.py`

### Responsibilities
Aggregates cognitive system state for dashboard display.

### State Aggregation

#### get_state_overview()

Overall cognitive state.

**Components:**
- Governance status
- Influence status
- Memory status
- Perception status
- System health

#### get_governance_state()

Governance system state.

**Components:**
- Pending approvals count
- Active policies
- Recent audit results

#### get_influence_state()

Influence system state.

**Components:**
- Active contracts
- Global influence status
- Domain influence status

#### get_stability_state()

System stability metrics.

**Components:**
- Error rates
- Latency metrics
- Resource usage

#### get_taqwin_state()

TAQWIN system state.

**Components:**
- Active observations
- Active proposals
- System mode

## Audit System

**Location:** `KNEZ/knez/cognitive/audit.py`

### Responsibilities
Consistency checks and audit reports.

### Audit Checks

#### run_all_audits()

Runs all consistency checks.

**Audit Types:**
- **consistency**: Data consistency checks
- **integrity**: System integrity checks
- **compliance**: Policy compliance checks

**Audit Result:**
```python
class AuditResult:
    check: str
    status: "pass" | "fail" | "warning"
    details: str
```

### Audit Areas

#### Memory Consistency
- Memory entry validation
- Evidence link validation
- Confidence score validation

#### Influence Consistency
- Contract validation
- Switch state validation
- Weight validation

#### Governance Consistency
- Approval queue validation
- Policy validation
- Audit trail validation

## Integration with Core Systems

### Router Integration
Influence system integrates with Router for backend selection:
- Router queries influence contracts
- Applies weights to backend scores
- Emits influence execution traces

### Event System Integration
All cognitive modules emit events:
- Influence decisions
- Approval requests/decisions
- Memory operations
- Perception updates
- Audit results

### Storage Integration
Cognitive data persisted to SQLite:
- Influence contracts
- Approval queue
- Memory entries
- Audit logs
- Perception snapshots

## Summary

KNEZ cognitive modules provide:
- **Influence System**: Modify behavior via contracts
- **Governance System**: Approval workflow and policies
- **Memory System**: Knowledge storage and hints
- **Perception System**: System monitoring
- **Runbook Generation**: Session summaries
- **Dashboard**: State aggregation
- **Audit System**: Consistency checks
