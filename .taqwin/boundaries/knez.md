# Boundary: KNEZ

Stamped: 2026-02-10T01:00+05:30

## Owns
- Model orchestration and routing
- Runtime hosting and process lifecycle
- Transport layers (HTTP/SSE/stdio framing) and client connectivity

## Does Not Own
- Memory truth
- Authority to mutate TAQWIN memory without explicit permission

## Constraints
- Cannot override TAQWIN memory law.
- Can terminate processes, but termination events must be logged as system events.
