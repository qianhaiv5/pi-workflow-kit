---
name: godot-tdd
description: >
  Test-driven development for Godot. Red-green-refactor loop adapted for GDScript (GUT)
  and C# (xUnit/NUnit). Use when building features or fixing bugs test-first, or when
  the user mentions "TDD", "test-first", or "red-green-refactor".
---

# Godot Test-Driven Development

TDD is the red → green loop. In Godot, testing has unique challenges: scene
instantiation, signal verification, physics simulation, and mixed GDScript/C#.
This skill adapts the TDD discipline for Godot's specific testing landscape.

## Testing frameworks

| Language | Framework | Best For |
|----------|-----------|----------|
| GDScript | [GUT](https://github.com/bitwes/Gut) | Scene tests, signal tests, UI interaction |
| C# | xUnit / NUnit | Data models, game logic, state machines, serialization |

## What a good Godot test is

Tests verify behavior through public interfaces — not internal `_process()` state,
not component children count. A test that breaks when you rearrange child nodes
without changing behavior is a bad test.

Good test reads like a player action: "when player picks up item, inventory count increases"
or "when health reaches zero, death animation plays."

### Godot anti-patterns

- **Scene-structure coupled** — asserts `get_child_count()` or specific node paths.
  The tell: test breaks when you rearrange the UI.
- **Signal-forgotten** — tests the direct method but not the signal emission.
  If the feature fires a signal, the test must `await` it.
- **Physics-untested** — assumes `_physics_process` behaves the same in test runner.
  Use `_physics_process(delta)` with explicit delta values, or extract logic.
- **Mock-the-world** — mocks every dependency so nothing real runs. In Godot,
  prefer integration tests with real nodes over deep mocking.
- **Timing-dependent** — uses `await get_tree().create_timer(1.0)` instead of
  signal assertions.

## Seams — where tests go

A **seam** in Godot is where you can observe behavior without reaching inside:

| Seam type | Example | Test approach |
|-----------|---------|---------------|
| **Method call** | `inventory.add_item(id)` | Call method, assert return + state change |
| **Signal emission** | `signal item_collected(id)` | `await` signal, verify parameters |
| **Exported variable** | `@export var max_health: int` | Set in test, read back |
| **Scene boundary** | Autoload -> Scene | Test autoload independently, mock in scene |
| **C# ↔ GDScript** | C# model → GDScript UI | Test C# logic in xUnit, test GDScript binding in GUT |

**Test only at pre-agreed seams.** Before writing any test, confirm with the user:
"Which seams should we test?" Not everything needs a test — focus on critical paths
and complex logic.

## Rules of the loop

- **Red before green.** Write the failing test, watch it fail, then write minimum code.
- **One slice at a time.** One seam, one test, one implementation per cycle.
- **For C# models:** test in xUnit first, then wire into Godot.
- **For GDScript scenes:** use `autoqfree(MyScene.instantiate())` pattern in GUT.
- **Refactoring is not part of the loop.** Refactor after the feature works, during code review.

## Mixed-strategy testing

With the GDScript/C# hybrid approach:

1. **C# data models** → xUnit unit tests (fast, independent of Godot)
2. **C# game logic** → xUnit integration tests (load GameState, manipulate, verify)
3. **GDScript UI scripts** → GUT scene tests (instantiate scene, simulate input, check signals)
4. **Autoload services** → Test in isolation; mock their signals in scene tests
5. **End-to-end** → Run the game via MCP `run_project`, use `execute_editor_script` to probe state

## GUT quick reference

```gdscript
extends GutTest

func test_player_takes_damage():
    var player = autoqfree(PlayerScene.instantiate())
    player.health = 100
    player.take_damage(30)
    assert_eq(player.health, 70)

func test_death_signal_on_zero_health():
    var player = autoqfree(PlayerScene.instantiate())
    player.health = 10
    watch_signals(player)
    player.take_damage(10)
    assert_signal_emitted(player, "died")
```

## xUnit quick reference (for C# models)

```csharp
[Fact]
public void TakeDamage_ReducesHealth()
{
    var state = new GameState { Health = 100 };
    state.TakeDamage(30);
    Assert.Equal(70, state.Health);
}

[Fact]
public void TakeDamage_FatalDamage_TriggersDeath()
{
    var state = new GameState { Health = 10 };
    bool died = false;
    state.Died += () => died = true;
    state.TakeDamage(10);
    Assert.True(died);
}
```
