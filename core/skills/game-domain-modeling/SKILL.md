---
name: game-domain-modeling
description: >
  Build and sharpen a game project's shared language. Define canonical terms for
  game mechanics, systems, and concepts so the agent speaks your language precisely.
  Adapted from mattpocock's domain-modeling skill for game development.
---

# Game Domain Modeling

Build a shared language between you and the agent. When the agent knows that
"Materialize" means "make a lesson occupy a real filesystem slot" (not "create
a 3D material"), every conversation gets shorter and more precise.

## File structure

```
/
├── CONTEXT.md          ← Game glossary (canonical terms)
├── docs/
│   └── adr/            ← Game design decisions worth recording
│       ├── 0001-chapter-unlock-system.md
│       └── 0002-save-file-schema-v2.md
└── scenes/
```

Create files lazily — only when you have something to write.

## CONTEXT.md format

A glossary, nothing else. No implementation details, no specs, no scratch notes.

```markdown
# Game Context — {{PROJECT_NAME_EN}}

## Core Concepts

- **Period**: A time slice of the day. Values: Morning (0), Noon (1), Dusk (2), Night (3).
  Changes trigger period-specific events and NPC schedules.
- **Chapter**: A main story segment. Unlocked sequentially. Each chapter has its
  own scene and exclusive mechanics.
- **Felt Layer**: A souvenir collection system. Players collect items from each
  chapter. Displayed in felt-style album UI.
- **SAN**: Sanity stat (0-100). Low SAN triggers hallucination events and dialog
  changes. Restored by rest and specific items.
- **Buff**: Temporary stat modifier applied to the player. Has a source, duration
  (in periods), and effect type.

## Systems

- **Save System**: Saves player state to `user://save_<slot>.json`. Includes
  stats, inventory, chapter progress, and timestamp.
- **DLC Manager**: Validates DLC entitlements, manages chapter unlock gates.
  Autoload: `DLCLicenseManager`.
- **Event Bus**: Global signal router. Use for cross-system communication.
  Autoload: `EventBus`.
- **Toast Manager**: Non-blocking notification overlay. Autoload: `ToastManager`.

## UI Conventions

- **Overlay Panel**: Modal panel that covers the screen with a semi-transparent
  background. Contains Back button. Used for: SaveLoad, Settings, Credits, DLC.
- **HUD**: Always-visible game UI layer showing time, stats, buffs.
```

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with CONTEXT.md, call it out:
"Your glossary defines 'Buff' as a temporary stat modifier, but you seem to
be describing a permanent upgrade — which is it?"

### Sharpen fuzzy language

"You said 'power-up' — do you mean a **Buff** (temporary) or a **Perk** (permanent)?
These are different systems."

### Stress-test with scenarios

"What happens when a Buff expires during a cutscene? Does the UI update or wait?"
"What if the player saves mid-chapter transition?"

### Cross-reference with code

When the user states how something works, check the code:
"Your `game_state.gd` says `san` ranges 0–100, but you said negative SAN is
possible — which is correct?"

### Update CONTEXT.md inline

When a term is resolved, update the file immediately. Don't batch.

### Offer ADRs sparingly

Only create an ADR when ALL three are true:
1. **Hard to reverse** — changing later requires save migration or scene rebuild
2. **Surprising without context** — a future dev would ask "why?"
3. **Real trade-off** — genuine alternatives existed

Format: `docs/adr/<NNNN>-<slug>.md`

```markdown
# ADR-0001: Chapter Unlock via DLC Manager

**Date**: 2026-07-28
**Status**: Accepted

## Context
We need to gate chapter access behind DLC ownership. Two options:
1. Scene-level gate: each chapter scene checks entitlement on load
2. Centralized gate: DLC Manager autoload handles all gating

## Decision
Centralized gate via `DLCLicenseManager` autoload.

## Rationale
- Single source of truth for entitlements
- Hot-reloadable without touching each scene
- Easier to add new chapters

## Consequences
- DLC Manager becomes a hard dependency for all chapter scenes
- Cannot test a chapter scene in isolation without mocking DLC Manager
```
