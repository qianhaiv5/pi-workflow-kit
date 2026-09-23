---
name: game-architecture-review
description: >
  Scan a Godot project for architectural friction — scene coupling, signal spaghetti,
  autoload bloat, resource duplication, node responsibility overlap. Present findings
  as an HTML report with Mermaid diagrams, then grill through the selected issue.
  Adapted from mattpocock's improve-codebase-architecture for game development.
disable-model-invocation: true
---

# Game Architecture Review

Surface architectural friction in a Godot project. Unlike traditional software where
"deep modules" is the goal, game architecture has its own failure modes. This skill
scans for game-specific anti-patterns and proposes refactors.

## What to scan for

### 1. Scene Coupling (high priority)
- Nodes that reference paths across scene boundaries (e.g. `get_node("/root/OtherScene/Player")`)
- Scenes that assume the existence of specific sibling nodes
- Hardcoded `change_scene_to_file()` paths scattered across scripts

### 2. Signal Spaghetti
- Signals that chain through 3+ nodes before reaching their target
- Signals emitted but never connected
- Signals used as catch-all events instead of typed communication

### 3. Autoload Bloat
- Autoloads > 200 lines that serve multiple unrelated concerns
- Autoloads that hold state better kept in scenes
- Autoloads that depend on other autoloads in a fragile order

### 4. Mixed-Language Friction (GDScript + C#)
- GDScript calling C# methods that could throw unhandled exceptions
- C# classes that duplicate Godot built-in functionality
- Type conversion hot spots between dynamic GDScript and static C#

### 5. Resource Duplication
- Same texture/material loaded in multiple scenes independently
- Duplicated node configuration that could be a shared scene/template
- Copy-pasted script blocks across sibling scenes

### 6. Node Responsibility Overlap
- Nodes that handle both UI logic AND game state
- "God nodes" (> 300 lines, 10+ responsibilities)
- Scenes that mix presentation, input handling, and data persistence

## Process

### Step 1 — Determine scope

If the user named a direction (scene, subsystem, autoload), scope there.
Otherwise, check `git log --oneline -30` to find hot spots — files that changed
most recently or most often. Focus on those first.

Use the Godot MCP native tools to:
- `get_scene_tree` — understand the current scene hierarchy
- `list_project_scripts` — count scripts per directory
- `get_editor_logs` — check for recurring warnings/errors
- `read_script` — sample scripts in hot-spot areas

### Step 2 — Explore and note friction

Use the `Explore` subagent to walk the codebase structure. For each script you read,
note where you experience friction:

- Does understanding this node require reading 5 other files?
- Is the `_ready()` function doing too much?
- Are signals connected to distant nodes?
- Is GDScript and C# code fighting over the same responsibility?
- Can you delete this node and the game still works? (deletion test for games)

### Step 3 — HTML Report

Write a self-contained HTML file to `%TEMP%` directory:
`%TEMP%/game-architecture-review-<timestamp>.html`

The report uses Tailwind CSS via CDN and Mermaid via CDN.

For each finding, render a card with:

| Field | Description |
|-------|-------------|
| **Files** | Which scenes/scripts are involved |
| **Category** | Scene Coupling / Signal Spaghetti / Autoload Bloat / Mixed-Lang Friction / Resource Duplication / Node Overlap |
| **Problem** | Why this is causing friction now |
| **Impact** | How it affects iteration speed, bug frequency, or AI-navigability |
| **Solution** | Plain description of the refactor |
| **Before / After diagram** | Mermaid graph showing the tangled vs clean structure |
| **Recommendation** | `Critical` / `Worth It` / `Nice to Have` |

End with **Top 3 recommendations** ranked by impact/cost ratio.

Do NOT propose specific code changes yet. After the file is written, open it
(`start <path>` on Windows) and ask: "Which one should we tackle?"

### Step 4 — Grilling loop

Once the user picks a finding, run a grilling session:
- What constraints does this refactor need to respect?
- What's the migration path? (Can we do it incrementally?)
- What tests would confirm we didn't break anything?
- Are there ADRs or design docs that constrain the solution?

If this creates or sharpens domain terms, update `CONTEXT.md` inline.
If the decision is load-bearing and surprising, offer to create an ADR in `docs/adr/`.

## Godot-specific patterns to recommend

| Problem | Pattern |
|---------|---------|
| Cross-scene references | Dependency injection via Autoload registry or exported NodePath |
| Signal spaghetti | EventBus autoload with typed signals |
| Autoload bloat | Split into single-responsibility autoloads; move scene-specific state to scenes |
| Resource duplication | Shared Resource preloads; theme-based styling |
| God nodes | Extract child scenes; use composition over inheritance |
| Mixed-language friction | Define clear API boundaries: C# for data/logic, GDScript for scene/UI |
