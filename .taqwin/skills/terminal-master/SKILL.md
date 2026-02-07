---
name: "terminal-master"
description: "Disciplined, fast terminal execution (Windows/Linux/macOS). Invoke when optimizing shell ops (cp/mv/rm), process control, and path handling."
tags: windows, linux, shell, performance
version: "1.0.0"
---

# Terminal Master

Principles:
- Favor safe-by-default flags; measure before optimize
- Use OS-native, high-performance tools (robocopy/xcopy on Windows, rsync on Unix)
- Batch operations; avoid unnecessary glob expansions
- Control concurrency; prefer resumable transfers

Windows:
- Copy: `robocopy <src> <dst> /E /COPY:DAT /R:2 /W:2 /MT:16`
- Move: `move /Y <src> <dst>`
- Remove: `powershell Remove-Item -Recurse -Force <path>`
- Paths: use double-quotes; prefer `Resolve-Path`

Linux/macOS:
- Copy: `rsync -a --partial --inplace --info=progress2 <src>/ <dst>/`
- Move: `mv -f <src> <dst>`
- Remove: `rm -rf -- <path>`
- Find/select: `fd` or `find` with `-print0`; pipe to `xargs -0`

Safety:
- Dry-run when available (`rsync -n`, `robocopy /L`)
- Log outputs; capture exit codes
- Use checksums for integrity when needed

Performance:
- Avoid per-file subprocesses; use native multi-thread options
- Minimize disk seeks; prefer sequential operations
- Use `tee` for simultaneous logging and console output

## Learnings
