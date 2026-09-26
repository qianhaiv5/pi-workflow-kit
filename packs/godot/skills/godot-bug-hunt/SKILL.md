---
name: godot-bug-hunt
description: >
  Disciplined diagnosis loop for hard bugs in Godot projects. Uses Godot MCP native
  tools for editor introspection, log capture, and runtime probing. Adapted from
  mattpocock's diagnosing-bugs skill. Use when the user reports a bug, crash,
  unexpected behavior, or performance issue in their Godot game.
---

# Godot Bug Hunt

A discipline for hard bugs in Godot. Skip phases only when explicitly justified.

## Phase 1 — Build a feedback loop

**This is the skill.** Everything else is mechanical. If you have a tight pass/fail
signal for the bug — one that goes red on THIS bug — you will find the cause.

### Godot-specific feedback loops (try in this order)

1. **GUT test** — Write a failing test that reproduces the exact symptom.
   Use `godot-tdd` skill for guidance.

2. **MCP `execute_editor_script`** — Run GDScript directly in the editor context
   to exercise the bug code path. Use `_custom_print()` to observe values.

3. **MCP `run_project` + `get_editor_logs`** — Launch the game, trigger the bug,
   capture logs. Filter for errors/warnings.

4. **MCP `debug_print`** — Add targeted debug prints to the running editor,
   check output in editor panel.

5. **Isolated scene test** — Create a minimal scene with only the buggy node,
   run it standalone.

6. **C# unit test** (for C# logic) — Extract the buggy logic into a pure C# method,
   test with xUnit outside Godot.

### Tighten the loop

Once you have ANY loop:
- Can it be faster? (Skip unrelated scenes, narrow input)
- Can the signal be sharper? (Assert on the exact symptom, not "didn't crash")
- Can it be deterministic? (Pin RNG seed, freeze time scale)

A 30-second flaky loop is barely useful; a 2-second deterministic one is a superpower.

### When you cannot build a loop

Stop and say so. List what you tried. Ask for:
- Specific reproduction steps
- A save file that reproduces the bug
- Permission to add `[DEBUG-xxxx]` instrumentation

Do NOT proceed to hypothesize without a loop.

## Phase 2 — Reproduce + Minimise

Run the loop. Confirm it produces the EXACT symptom the user described.
Then shrink to the smallest scenario that still goes red. Cut one element
at a time — re-run after each cut. Keep only what's load-bearing.

## Phase 3 — Hypothesise

Generate **3–5 ranked hypotheses** before testing any.

Format: "If <X> is the cause, then <changing Y> will fix it / <changing Z> will make it worse."

Show the ranked list to the user before testing. They know the codebase.

## Phase 4 — Instrument

Godot instrumentation options:

1. **Godot debugger breakpoint** (if editor attached)
2. **MCP `execute_editor_script`** — probe node state directly
3. **`debug_print` via MCP** — tagged print statements: `[DEBUG-a4f2] value: {x}`
4. **`get_node_properties` via MCP** — inspect node state at runtime
5. **C# debugger** (if using C#) — attach Visual Studio / Rider

Change ONE variable at a time. Tag all debug output with `[DEBUG-xxxx]` for easy cleanup.

## Phase 5 — Fix + regression test

Write the regression test BEFORE the fix. Use the minimised repro from Phase 2.
If no good seam exists for the regression test, that itself is the finding —
flag it for `/game-architecture-review`.

1. Turn minimised repro into a test
2. Watch it fail
3. Apply the fix
4. Watch it pass
5. Re-run the Phase 1 loop against the original scenario

## Phase 6 — Cleanup

- [ ] Original bug no longer reproduces
- [ ] Regression test passes (or seam absence is documented)
- [ ] All `[DEBUG-xxxx]` instrumentation removed
- [ ] Correct hypothesis stated in commit message

**Then ask: what would have prevented this bug?** If it's architectural
(signal never connected, missing null check on cross-scene reference,
autoload initialization order), hand off to `/game-architecture-review`.


---

## 上游实战增补（2026-09-26 回灌 · 每条都带判据）
### `autowrap` Label 的隐藏期布局爆炸
- `autowrap` Label 在 `hidden` 期**布局会爆炸**（min-height 虚高）⇒ **判可见性/尺寸禁在隐藏期采样**；
  布局数值必须在**可见期**实测（上游真因：详情页白板 / 事件页按钮失效）。

### 吞点击族（本引擎高频根因）
- 全屏 / 隐藏 `Control` 会**沿父链吞掉点击**（`mouse_filter` 默认 `STOP`）⇒ 新增 UI 后必须清点根节点 `mouse_filter`；
  诊断路径：先问「**谁吃掉了事件**」再查「被点的控件为什么没响应」。上游同族 5+ 次（相机快门死区 / 桌角二维码 / 图标点不响）。

### `Node.name` 遮蔽符号 ⇒ 静默解析
- `Node.name` 可能与脚本符号**同名** ⇒ 静默解析成**错对象**（不报错）；
  场景/资源绑定必须以**数据语义**为准，**禁把「名字像」当绑定**。
