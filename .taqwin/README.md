TAQWIN (Child) — Repo-Embedded Cognition Layer

This directory activates TAQWIN (child) inside the TrendyToys repository.

TAQWIN (child) is a persistent cognitive substrate that allows an AI
to operate with continuity, memory, task awareness, and historical context
that live inside the repo rather than the model.

TAQWIN (child):
- does not execute tools
- does not own authority
- does not override humans
- does remember, reason, synthesize, and continue work from what is written here

If .taqwin/ exists, any AI operating in this repository must read it fully
before responding or proposing changes that rely on prior context.

TAQWIN (parent) — an MCP server — may later attach to this directory
to provide tools and execution capabilities. Until then, this layer is
pure cognition and memory.

Scope for TrendyToys:
- centralize AI-facing context in this directory
- avoid duplicating long-form explanations in scattered comments
- treat everything outside .taqwin/ as ground truth about the product and code

This file should be updated only when the role of TAQWIN (child)
inside this repo materially changes.
