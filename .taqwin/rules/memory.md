# Memory Law (Append-Only · Evidence-Backed · Chunked)

Stamped: 2026-02-10T01:00+05:30

## Laws

### 1) Append-Only
- Memory artifacts are append-only by default.
- Merging is explicit and recorded as a lineage event.
- Forking is allowed; merging requires a declared reconciliation.

### 2) Sessions Are Task-Bound
- Sessions are task-bound, not user-bound.
- A session must resolve into one terminal state: SUCCESS, FAILED, ABORTED.

### 3) Lineage Is Immutable
- Lineage identifiers are immutable once emitted.
- Evidence for lineage lives in ingestion manifests and checkpoint files.

## Data Scanning & Serialization Model (Shotgun / Scatter–Gather)

### Intent
Deliver memory efficiency and recoverability while ingesting large data sources.

### Core Algorithm
1. Decide the delivery mode based on data size: OPTIMAL (chunked) or NORMAL (single-pass).
2. Divide data into hierarchical chunks.
3. Deliver chunks in parallel (“shotgun”) while maintaining a safeline for recovery.
4. Gather outputs deterministically into a canonical index.

### Hierarchical Chunk IDs
Every ingested unit must be addressable:
- `doc_id`: stable identifier for a file (derived from repo-relative path + sha256 prefix)
- `chunk_id`: hierarchical ID inside the doc (sections / blocks / line ranges)
- `parent_id`: parent chunk (or doc root)
- `range`: byte range and/or line range (for text)

### Safeline (Recovery)
At minimum, each ingestion run must produce:
- a manifest (append-only, JSONL recommended)
- a checkpoint file that can resume or audit the ingestion

### Non-Skipping Rule
- If any file in scope cannot be read, ingestion halts immediately.
- The halt is recorded with the file path, error, and recovery action.

## Evidence Requirements
- All “repo-wide” statements must be traceable to a manifest entry.
- If a statement cannot be evidenced: mark as UNKNOWN.
