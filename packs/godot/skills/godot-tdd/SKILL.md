---
name: godot-tdd
description: >
  Test-driven development for Godot. Red-green-refactor loop adapted for GDScript (e.g. GUT)   <!-- 变体：跑器/框架由 `apply-kit --test-runner` 决定（KIT-GOVERNANCE §2 变体声明制） -->
  and C# (e.g. xUnit/NUnit). Use when building features or fixing bugs test-first, or when   <!-- 变体：跑器/框架由 `apply-kit --test-runner` 决定（KIT-GOVERNANCE §2 变体声明制） -->
  the user mentions "TDD", "test-first", or "red-green-refactor".
---

# Godot Test-Driven Development

TDD is the red → green loop. In Godot, testing has unique challenges: scene
instantiation, signal verification, physics simulation, and mixed GDScript/C#.
This skill adapts the TDD discipline for Godot's specific testing landscape.

## Testing frameworks

| Language | Framework | Best For |
|----------|-----------|----------|
| GDScript | [GUT](https://github.com/bitwes/Gut)（**变体：若项目采用**；见 `--test-runner`） | Scene tests, signal tests, UI interaction |
| C# | xUnit / NUnit（**变体：若项目有 C#**） | Data models, game logic, state machines, serialization |

> ⚠️ **先确认你项目的跑器**：由 `apply-kit --test-runner`（见 KIT-GOVERNANCE §2.1 `kit-binding`）与 §2.2 的**示例标注**决定「用哪个」；
> **GUT / xUnit 仅为示例**，不是默认框架。若项目不用它们 ⇒ 本技能的「GUT / xUnit quick reference」两节仅作参考，请以项目自有跑器为准。

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
| **C# ↔ GDScript** | C# model → GDScript UI | Test C# logic in xUnit, test GDScript binding in GUT |   <!-- 变体：跑器/框架由 `apply-kit --test-runner` 决定（KIT-GOVERNANCE §2 变体声明制） -->

**Test only at pre-agreed seams.** Before writing any test, confirm with the user:
"Which seams should we test?" Not everything needs a test — focus on critical paths
and complex logic.

## Rules of the loop

- **Red before green.** Write the failing test, watch it fail, then write minimum code.
- **One slice at a time.** One seam, one test, one implementation per cycle.
- **For C# models:** test in xUnit first, then wire into Godot.   <!-- 变体：跑器/框架由 `apply-kit --test-runner` 决定（KIT-GOVERNANCE §2 变体声明制） -->
- **For GDScript scenes:** use `autoqfree(MyScene.instantiate())` pattern in GUT.   <!-- 变体：跑器/框架由 `apply-kit --test-runner` 决定（KIT-GOVERNANCE §2 变体声明制） -->
- **Refactoring is not part of the loop.** Refactor after the feature works, during code review.

## Mixed-strategy testing

With the GDScript/C# hybrid approach:

1. **C# data models** → xUnit unit tests (fast, independent of Godot)   <!-- 变体：跑器/框架由 `apply-kit --test-runner` 决定（KIT-GOVERNANCE §2 变体声明制） -->
2. **C# game logic** → xUnit integration tests (load GameState, manipulate, verify)   <!-- 变体：跑器/框架由 `apply-kit --test-runner` 决定（KIT-GOVERNANCE §2 变体声明制） -->
3. **GDScript UI scripts** → GUT scene tests (instantiate scene, simulate input, check signals)   <!-- 变体：跑器/框架由 `apply-kit --test-runner` 决定（KIT-GOVERNANCE §2 变体声明制） -->
4. **Autoload services** → Test in isolation; mock their signals in scene tests
5. **End-to-end** → Run the game via MCP `run_project`, use `execute_editor_script` to probe state

## GUT quick reference   <!-- 变体：跑器/框架由 `apply-kit --test-runner` 决定（KIT-GOVERNANCE §2 变体声明制） -->

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

## xUnit quick reference (for C# models)   <!-- 变体：跑器/框架由 `apply-kit --test-runner` 决定（KIT-GOVERNANCE §2 变体声明制） -->

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

---

## 上游实战增补（2026-09-26 回灌 · 每条都带判据）
### 帧驱动系统的容差断言
- 容差必须与被驱动量的**单步增量**比较（步长 × 倍速 × **最坏帧时**）；禁拍一个绝对数。
- **引入每帧推进的系统时，同批复查所有「`await` 后立刻断值」的既有断言** ⇒ 冻结帧时钟 / 显式推帧。
- 上游实证：`±0.05` 概率性红（批量约 1/8）—— 真因是 `await` 那帧的真实 delta 直进电量（150 ms ⇒ +0.499）。

### fixture 隔离
- 测试与**玩家档**（`user://`）必须隔离（独立 user dir / 临时档）；**fixture 禁共享真实档**。
- 上游实证：测试环境与玩家 `user://` 共享 ⇒ 污染事故；判据 = 跑测后玩家档 mtime 不变。

### 引擎边车（`.uid` / `.import` / `.gdignore`）
- 白名单式目录门禁**默认跳过**引擎边车，且必须把该豁免**写进规范**（否则门禁对边车误报，或被用来藏文件）。
