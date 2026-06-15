# TAQWIN Hierarchical Navigation - User Guide

**Feature**: 3-Tier Project → Session → Detail Navigation  
**Version**: 1.0  
**Date**: 2026-06-14  
**Component**: TaqwinHierarchicalView

---

## 🎯 OVERVIEW

The TAQWIN Hierarchical View provides a structured way to explore your development sessions organized by project. Think of it like a file system:

```
📁 Projects (like folders)
  └─ 🔵 Sessions (like files in a folder)
       └─ 📊 Session Details (like file contents)
```

---

## 🚀 QUICK START

### Step 1: View Projects
When you open TAQWIN Hierarchy, you'll see all your projects:

```
┌─────────────────────────────────────────────────────┐
│ Projects                                  [Search] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📁 knez-control-app                                │
│     knez-control-app                                │
│     C:\...\controlAPP\knez-control-app              │
│     Tauri + React control application               │
│                                                     │
│  📁 taqwin-mcp-server                               │
│     taqwin-mcp-server                               │
│     C:\...\TAQWIN_V1\TAQWIN-MCP-SERVER              │
│     Python MCP server for session management        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**What you see**:
- Project icon (📁)
- Project name (display name)
- Project ID (unique identifier)
- Project path (filesystem location)
- Description (if available)

**What you can do**:
- Search for projects by name or ID
- Click a project to see its sessions

---

### Step 2: View Sessions (for selected project)

After clicking a project, you'll see all sessions within that project:

```
┌─────────────────────────────────────────────────────┐
│ Sessions                        ← Back    [Search] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🔵 CA009: Data Visualization Explorer              │
│     CA009                                           │
│     Type: CODE_ANALYSIS                             │
│     [7 checkpoints] [15 events]                     │
│     Created: 2026-06-13 14:36:29                    │
│                                                     │
│  🔵 CA010: COZINN Admin User Management             │
│     CA010                                           │
│     Type: CODE_ANALYSIS                             │
│     [2 checkpoints] [8 events]                      │
│     Created: 2026-06-14 08:06:02                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**What you see**:
- Session icon (🔵)
- Session name (descriptive title)
- Session ID (traceable identifier like CA009)
- Session type (CODE_ANALYSIS, GENERAL, etc.)
- Metrics badges (checkpoint count, event count)
- Creation timestamp

**What you can do**:
- Click "← Back" to return to projects
- Search for sessions by name or ID
- Click a session to see its details

---

### Step 3: View Session Details

After clicking a session, you'll see comprehensive details and timeline:

```
┌─────────────────────────────────────────────────────┐
│ Details                         ← Back              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Session: CA009 - Data Visualization Explorer      │
│  [ID: CA009] [CODE_ANALYSIS] [ACTIVE]              │
│                                                     │
│  [Evolution Analysis] [Data Sections]               │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  📌 Checkpoints (7)              [Expand] ▼ │   │
│  │  ─────────────────────────────────────────── │   │
│  │  • CP001: Initial Implementation            │   │
│  │  • CP002: Database Access Refactor          │   │
│  │  • CP007: Project Navigation Implementation │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  📅 Events (15)                  [Expand] ▼ │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  🎯 Decisions (4)                [Expand] ▼ │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**What you see**:
- Session metadata (ID, type, status)
- Two view modes:
  - **Evolution Analysis**: Timeline chart showing activity over time
  - **Data Sections**: Collapsible sections for each data type
- Expandable sections for:
  - 📌 Checkpoints (context snapshots)
  - 📅 Events (dev events, file changes)
  - 🎯 Decisions (architectural decisions)
  - 💡 Insights (discovered patterns)
  - 📁 File Changes (modified files)

**What you can do**:
- Click "← Back" to return to sessions
- Switch between "Evolution Analysis" and "Data Sections" tabs
- Expand/collapse sections to see details
- Scroll through timeline events

---

## 📊 VIEW MODES

### Evolution Analysis Mode
Shows a visual timeline chart of all session activity:

```
Activity Timeline
─────────────────────────────────────────────────────
 |
 |  ███     ██           ████         ██
 |  ███     ██    ██     ████    █    ██     ███
 |  ███  █  ██    ██     ████    █    ██  █  ███
 └──────────────────────────────────────────────────►
   8AM   9AM   10AM   11AM   12PM   1PM    2PM
   
Legend:
█ Checkpoint  █ Event  █ Decision  █ File Change
```

**Use this when you want to**:
- See when work happened during the session
- Identify activity patterns (busy periods vs quiet periods)
- Understand session evolution over time

### Data Sections Mode
Shows organized, collapsible sections for each data type:

```
📌 Checkpoints (7)                          [▼]
─────────────────────────────────────────────
  • CP001: Initial Implementation
    2026-06-13 14:43:43
  • CP002: Database Access Refactor
    2026-06-13 15:01:07
  • CP007: Project Navigation
    2026-06-14 10:52:15

📅 Events (15)                              [▼]
─────────────────────────────────────────────
  • dev_event: File changes
    2026-06-13 15:15:20
  • dev_event: Schema updates
    2026-06-13 16:30:45

🎯 Decisions (4)                            [▼]
─────────────────────────────────────────────
  • Use 3-level hierarchical navigation
    2026-06-14 10:45:00
  • Load sessions on-demand
    2026-06-14 10:48:30
```

**Use this when you want to**:
- Browse specific types of data (just checkpoints, just decisions)
- See detailed information for each item
- Get an organized view of session contents

---

## 🔍 SEARCH FUNCTIONALITY

### Search Projects
At the projects level, search by:
- Project name (e.g., "control-app")
- Project ID (e.g., "knez-control-app")

### Search Sessions
At the sessions level, search by:
- Session name (e.g., "Data Visualization")
- Session ID (e.g., "CA009")

**Example**:
```
Search: "visualization"
Results:
  🔵 CA009: Data Visualization Explorer
```

---

## 🧭 NAVIGATION PATTERNS

### Pattern 1: Explore Project
```
Projects → Click "knez-control-app" → View all sessions
```

### Pattern 2: Find Specific Session
```
Projects → Click project → Search "CA009" → Click session → View details
```

### Pattern 3: Browse Recent Work
```
Projects → Click project → Sessions sorted by date → Click latest session
```

### Pattern 4: Deep Dive Analysis
```
Projects → Click project → Click session → Evolution Analysis → See timeline
```

---

## 💡 PRO TIPS

### 1. **Use the Back Button**
Don't search for projects again—just click "← Back" to return to previous level.

### 2. **Session Badges Tell a Story**
- High checkpoint count = lots of progress tracking
- High event count = active development
- Low counts = simple or incomplete session

### 3. **Project Path Shows Location**
Use the project path to understand which codebase the session relates to.

### 4. **Switch View Modes**
- Start with "Evolution Analysis" to get the big picture
- Switch to "Data Sections" to drill into specific details

### 5. **Expand Only What You Need**
In Data Sections mode, keep most sections collapsed and expand only what you're interested in.

---

## 🔧 TECHNICAL DETAILS

### Database Structure
```
projects table
  ├─ project_id (PRIMARY KEY)
  ├─ project_name
  ├─ project_path
  └─ ...

sessions table
  ├─ session_id (PRIMARY KEY)
  ├─ display_id
  ├─ name
  ├─ project_id (FOREIGN KEY → projects.project_id)
  └─ ...

checkpoints, events, decisions, etc.
  ├─ session_id (FOREIGN KEY → sessions.session_id)
  └─ ...
```

### Data Loading Strategy
- **Projects**: Loaded once on mount
- **Sessions**: Loaded when project is selected
- **Session Details**: Loaded when session is selected

This "lazy loading" approach ensures fast initial page load.

---

## ❓ FAQ

### Q: Why don't I see any projects?
**A**: The projects table may be empty. Run the TAQWIN MCP project registration scripts to populate it.

### Q: Why are some sessions not in any project?
**A**: Sessions created before Phase 2 don't have project associations. Use the association scripts to link them.

### Q: What's the difference between session_id and display_id?
**A**: 
- **session_id**: Primary key (CA015 for new sessions, UUID for old sessions)
- **display_id**: Human-readable ID (always like CA009, CA011, CA015)

### Q: Can I see sessions across all projects?
**A**: Not in the current version. Select one project at a time to view its sessions.

### Q: How do I add a new project?
**A**: Projects are auto-detected and registered by TAQWIN MCP. Use the project registration scripts.

---

## 🐛 TROUBLESHOOTING

### Issue: "No projects found"
**Solution**: 
1. Check database path: `C:\Users\syedm\taqwin_memory.db`
2. Verify projects table exists: `sqlite3 taqwin_memory.db ".schema projects"`
3. Run project registration script

### Issue: "No sessions found for this project"
**Solution**:
1. Verify sessions have project_id: `SELECT session_id, project_id FROM sessions`
2. Use association script to link sessions to projects

### Issue: "Failed to load hierarchy"
**Solution**:
1. Check session_id format (UUID vs traceable ID)
2. Verify session exists in database
3. Check console for error messages

---

## 📚 RELATED DOCUMENTATION

- `TAQWIN_DATA_STRUCTURE_FOR_DASHBOARD.md` - Complete database schema
- `DATA_VISUALIZATION_SESSION_COMPLETE.md` - Implementation summary
- `CA011_SESSION_RESUME_SUMMARY.md` - Phase 1 & 2 implementation

---

**Version**: 1.0  
**Last Updated**: 2026-06-14  
**Feedback**: Report issues or suggestions in session CA009
