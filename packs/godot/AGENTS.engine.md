# Godot pack · 引擎块（apply-kit 会把下面三段注入 `AGENTS.md` 的对应占位符）

<!-- redlines:start -->

| # | 规则 |
|---|------|
| E1 | **所有 Godot 文件操作走 gdmcp CLI 或 MCP**。禁止 write/edit 工具直接操作 `.tscn/.tres/.gd`（`.cs` 属纯文本源码，可 write/edit 但必须过编译） |
| E2 | **project.godot 枚举用整数值**（`mode=2` 非 `=viewport`） |
| E3 | **UID 由 Godot 自动生成**，不手写 `uid://` |
| E4 | **C# 编译必过**：`.cs` 变更后 `dotnet build` 零错误 |   <!-- 变体：若项目有 C#（KIT-GOVERNANCE §2 变体声明制） -->
| E5 | **交互命中：三种载体任选其一（选型由项目 ADR 定），禁「双路径混用」，禁把 2D 叠加层当 3D 命中层**：① 纯 2D 场景直接用 `Control` 树 / 真 GUI；② **若** UI 承载在 `SubViewport` 内 ⇒ 左键 press+release **成对** `push_input`，且 LEFT/WHEEL/motion **全类型走唯一转发入口**（双路径会分裂 press/release 语义 ⇒ 按钮点不响）；③ **3D 世界** ⇒ 射线命中（`camera.project_ray_origin/normal` + `PhysicsDirectSpaceState3D.intersect_ray`）。**禁**用「2D `Control` 叠加层」当 3D 世界的热点命中层 |
| E6 | **拖拽与点击由同一条硬阈值区分；禁依赖 GUI 控件的拖拽事件**：手势/视角拖拽走 Node 级 `_input()` / `_unhandled_input()` + 自身 rect 判定 —— 子控件（`mouse_filter=STOP`）会吃掉 press，motion 在 `SubViewport` GUI **不冒泡**（实测）；「按住拖拽 = 拖」与「点击 = 交互」由同一条**位移/时间阈值**判定（**阈值数值属项目待定项，禁自创**） |
| E7 | **单动作互斥**：同一时刻只允许一个「动作」在进行。**若**项目采用模态态（如「观览态 / 手机态」）⇒ 任一时刻**恰有一态**，且进入受限态必须**显式冻结**上一态输入 —— `set_process_input(false)` ＋ `set_process_unhandled_input(false)` ＋ **悬挂 `_process` 中的悬停转换**（三者缺一不可，漏一处即泄漏，实测）；退出时全部恢复。**无论是否模态**：交互进行中视角仍应可自由拖拽（否则造出「点一下等三秒」的陷阱） |

> **E5–E7 换代说明（2026-09-26 · 由《田园里的苗族少女》`ADR-002` 实践回灌）**：本 kit 旧版把「SubViewport GUI 转发」与「观览态/手机态**模态互斥**」写成**通用红线**。实践修正两点：① **命中载体应由项目 ADR 选型**（真 GUI / SubViewport 转发 / 3D 射线都合法，**禁混用**）；② **「手机态 / 观览态」是一套具体产品形态，不是通用红线** —— 当默认会强迫新项目实现一套它可能不需要的模态。⇒ 现版改为「**原则 + 条件式 + 选型留白**」，硬-won 机理（成对 push_input / 全类型唯一入口 / motion 不冒泡 / 模态泄漏三件事）**全部保留**。旧条文见 git 历史（`a487c82` 及以前）。
| E8 | **一个逻辑编辑器**：Mono 版是 `Godot_*_console.exe`（启动器）+ `Godot_*win64.exe`（真编辑器）两进程、参数相同 ⇒ 判重复要按 `--path/--editor` **参数去重后数**，进程数 2 是正常的 1 个；真重复 = 两组同参数进程 |
| E9 | **编辑器会话双态 ⇒ 判「生效」只认磁盘 / 运行时，不认 inspector**：`.tscn` / 场景节点的批操作后**必须显式 save + `git diff` 复核**；「inspector 里看着对」**不是证据**（内存态 ≠ 磁盘 ≠ 运行时 —— 上游实测三态不一致）。同族：编辑器可能把它内存里的旧版脚本**写回磁盘**覆盖外部修改 ⇒ 改完 `.gd` 必须复读 + diff。 |

<!-- redlines:end -->

<!-- selfchecks:start -->

| # | 检查项 | 方法 |
|---|--------|------|
| E1 | 脚本无报错 | `gdmcp --json scripts validate <path>` |
| E2 | C# 编译 | `dotnet build`（如有 .cs 变更） |   <!-- 变体：若项目有 C#（KIT-GOVERNANCE §2 变体声明制） -->
| E3 | 场景可加载 | `gdmcp --json scenes open <path>` |
| E4 | 信号连接 | 每个 `@onready var` 路径与 tscn 一致 |
| E5 | **任何可能不自退的 Godot 调用必须套超时** | 跑脚本用 `-s <script>`；跑场景**必带** `--quit-after <帧>` 或 `--quit`；**禁**用 `\| head` 当护栏（管道**不终止**进程）；子代理 bash「无输出」**优先怀疑被不自退进程阻塞** （上游实测：探针缺退出条件 ⇒ bash 永久阻塞、子代理静默挂死 30 min） |

<!-- selfchecks:end -->

<!-- blocks:start -->

<!-- godot-cli-rule:start -->
# Godot CLI-Only Rule

ALL Godot operations via `gdmcp` CLI or MCP. NEVER directly edit `.tscn`, `.tres`, or `.gd` on disk.
`.cs` is plain text source: `write`/`edit` **is** allowed, but it must pass the compiler (`dotnet build` zero errors).   <!-- 变体：若项目有 C#（KIT-GOVERNANCE §2 变体声明制） -->
（2026-09-27 拍板：`.cs` 通道以**项目宪法 E1** 为准 —— 原「NEVER … `.cs`」表述作废）

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
每次 .cs 变更后必须 `dotnet build` 通过。CI 必须检查 C# 编译。   <!-- 变体：若项目有 C#（KIT-GOVERNANCE §2 变体声明制） -->

## File Organization
- `scripts/cs/` — C# 源码（Models/Systems/Bridges）
- `autoload/` — 全局单例（GDScript）
- `features/` — 游戏系统（GDScript，纯逻辑不依赖 content/）
- `ui/` — UI层（GDScript，只读系统数据，信号解耦）
- `content/` — 内容层（关卡/事件/菜品/对话，替换不影响系统）
- `data/` — JSON配置表
<!-- gds-csharp-hybrid:end -->

<!-- blocks:end -->
