# Godot pack · 引擎块（apply-kit 会把下面三段注入 `AGENTS.md` 的对应占位符）

<!-- redlines:start -->

| # | 规则 |
|---|------|
| E1 | **所有 Godot 文件操作走 gdmcp CLI 或 MCP**。禁止 write/edit 工具直接操作 `.tscn/.tres/.gd`（`.cs` 属纯文本源码，可 write/edit 但必须过编译） |
| E2 | **project.godot 枚举用整数值**（`mode=2` 非 `=viewport`） |
| E3 | **UID 由 Godot 自动生成**，不手写 `uid://` |
| E4 | **C# 编译必过**：`.cs` 变更后 `dotnet build` 零错误 |
| E5 | **SubViewport 点击交互一律走 GUI 转发，禁止坐标命中分支**：SubViewport 内左键 press+release 成对 `push_input`，主页图标/APP 内控件都是真实 Button 走 GUI。双路径会分裂 press/release 语义导致按钮点不响。转发必须全类型（LEFT/WHEEL/motion 拖动）走唯一入口 `_forward_event_to_viewport` |
| E6 | **手势类输入（滚动/拖动/长按）用 Node 级 `_input()` + 自身 rect 判定，禁止依赖 `_gui_input` 冒泡**：子控件（Button `mouse_filter=STOP`）会吃掉 press，motion 在 SubViewport GUI 不冒泡（实测）。参考 `scroll_pager.gd`。点击类（Button 等）仍走 GUI |
| E7 | **视角控制为独立输入域，且与手机态模态互斥**：全景 yaw/pitch 拖拽 + WHEEL 用 Node 级 `_input()` + 自身全屏 rect（同 E6），**禁止 push_input、禁止 SubViewportContainer、禁止坐标命中分支**；ESC 走 `_unhandled_input`。**模态互斥铁律**：观览态与手机态任一时刻恰有一态——观览态禁止任何可见可点 Control，手机态禁止全景接收输入。**进观览态必须显式冻结手机输入（三件事缺一不可）**：`set_process_input(false)` + `set_process_unhandled_input(false)` **+ 悬挂 `_process` 中的悬停转换**，退出全部恢复 |
| E8 | **一个逻辑编辑器**：Mono 版是 `Godot_*_console.exe`（启动器）+ `Godot_*win64.exe`（真编辑器）两进程、参数相同 ⇒ 判重复要按 `--path/--editor` **参数去重后数**，进程数 2 是正常的 1 个；真重复 = 两组同参数进程 |

<!-- redlines:end -->

<!-- selfchecks:start -->

| # | 检查项 | 方法 |
|---|--------|------|
| E1 | 脚本无报错 | `gdmcp --json scripts validate <path>` |
| E2 | C# 编译 | `dotnet build`（如有 .cs 变更） |
| E3 | 场景可加载 | `gdmcp --json scenes open <path>` |
| E4 | 信号连接 | 每个 `@onready var` 路径与 tscn 一致 |

<!-- selfchecks:end -->

<!-- blocks:start -->

<!-- godot-cli-rule:start -->
# Godot CLI-Only Rule

ALL Godot operations via `gdmcp` CLI or MCP. NEVER directly edit `.tscn`, `.tres`, `.gd`, or `.cs` on disk.

**CLI:** `MSYS_NO_PATHCONV=1 ./.gdmcp/bin/gdmcp.exe --json <command>`
**MCP:** `mcp({ server: "godot-mcp-native", tool: "..." })`

Destructive commands require `--apply`. Runtime commands require `--allow-open-world`.
<!-- godot-cli-rule:end -->

<!-- gds-csharp-hybrid:start -->
# GDScript / C# Hybrid Strategy

## Inheritance Boundary (CRITICAL)
GDScript ↔ C# 互不继承。共享接口走 Composition 或 EventBus 信号。

## Cross-Language Encapsulation
C#→GDScript / GDScript→C# 互操作必须走 Bridge 类。禁止散落 `Call()/Get()/Set()`。

## C# Build
每次 .cs 变更后必须 `dotnet build` 通过。CI 必须检查 C# 编译。

## File Organization
- `scripts/cs/` — C# 源码（Models/Systems/Bridges）
- `autoload/` — 全局单例（GDScript）
- `features/` — 游戏系统（GDScript，纯逻辑不依赖 content/）
- `ui/` — UI层（GDScript，只读系统数据，信号解耦）
- `content/` — 内容层（关卡/事件/菜品/对话，替换不影响系统）
- `data/` — JSON配置表
<!-- gds-csharp-hybrid:end -->

<!-- blocks:end -->
