---
name: safe-refactor
description: >
  Godot 项目安全重构三步法：门面保名兼容 → 每步独立验证 → 偏差显式记录。
  针对"上帝对象拆分、核心系统重构、autoload 迁移"等高风险改动，保证行为不变、
  测试零改动、存档契约零风险。源自 ADR-002 GameState 拆分执行范式（2026-08-10
  实战验证：1771 行→555 行，GUT 290/290 全程零破坏）。
disable-model-invocation: true
---

# Safe Refactor 安全重构三步法

Godot 游戏项目里重构核心系统（GameState/autoload/存档）时，最常见的失败是：
**行为悄悄变了、测试大面积红、存档不兼容、重构完留下一堆死代码**。
本技能提供一套经过实战验证的三步法，把"高风险重构"变成"低风险机械操作"。

## 适用场景

- 上帝对象拆分（大 autoload 拆多模块）
- autoload 迁移位置 / 注册顺序调整
- 核心系统（存档/时钟/信号链）行为不变的改造
- 任何"测试必须零改动"的约束型重构

## 铁律（违反即失败）

1. **门面保名兼容**：被外部（features/ui/tests）调用的方法必须保留原名 1 行 delegate——测试零改动是硬指标
2. **序列化数据不迁移**：存档字段（to_dict/from_dict 涉及的一切 var）留原容器；模块只持运行时态（`_` 前缀非序列化 var）——存档契约（S12）零风险
3. **拆了必须接线**：新模块必须当次任务被驱动（autoload 注册 / 容器持有 / 被调用），否则变死代码（本项目 5 死代码全部是"拆了没接线"）
4. **禁止整文件重写**：大文件用 MCP modify_script 单行/分段替换 + execute_editor_script 块删除；重写丢成员声明是历史教训（RadioDot 事故）
5. **每步独立提交**：每步完成 = validate + 全量 GUT + 门禁，全绿才进下一步

## 三步法流程

### Step 0 · 基线锁定

```bash
# 全量回归确认当前是绿的（这是你的安全网）
# ⚠️ fresh clone / 新机器先 --import 生成 global_script_class_cache（class_name 注册仅来自 editor scan；headless -s 不扫描，缺缓存 → PanelUtils 等依赖面板测试 Parse Error）
godot --headless --path . --import
godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit
python tools/check_health.py          # 健康门禁基线
git commit -m "baseline"              # 可回滚锚点
```

### Step 1 · 门面兼容层（先搭桥，再拆桥）

被外部引用的方法 → 保留原名，函数体改为 1 行 delegate：

```gdscript
# 旧：func check_credit_status() -> void: <17行逻辑>
# 新：
func check_credit_status() -> void: _credit_svc.check_credit_status()
```

关键决策：
- **被测试直戳的私有成员**（`_chat_states` 等）：var 留原容器（var 访问自动兼容）> 测试轻改。优先零改动，万不得已才允许 ≤10 行测试轻改且必须记录
- **运行中被调用的方法**：grep 调用面（tests/features/ui），逐个保名
- **无外部调用者的内部函数**：可整体移除不设门面（`_check_chat_system` 先例）

### Step 2 · 逐模块迁移（低风险 → 高风险顺序）

迁移顺序原则：**纯函数 → 无 _process 状态机 → 有 _process 引擎 → 最大耦合块**。

| 模块类型 | 形态 | 存放 | 先例 |
|---------|------|------|------|
| 纯工具（日期/数学） | RefCounted·static | autoload/ | date_utils.gd |
| 纯状态机（无 _process 无 Node） | RefCounted·组合（容器 `load().new(self)` 持有） | autoload/ | credit_service.gd |
| 业务引擎（需 _process/音频/定时器） | Node·autoload 注册 | autoload/ | video_engine.gd / social_engine.gd |
| 纯逻辑服务（按需实例化） | RefCounted | autoload/ | delivery_service.gd |

- 引擎类必须在 project.godot 注册于容器**之后**（帧序=注册序：时钟先推进，引擎后 tick）
- 引擎门面用 `get_node("/root/XXX")` 惰性解析（注册晚于容器 _ready 时未入树）
- 迁移后 grep 验证原函数零残留

### Step 3 · 收尾验证 + 归档

```bash
python tools/check_health.py                     # 依赖/死代码/BOM 全绿
godot --headless ... -gexit                      # GUT 全量（必须=基线数量）
grep -rn "旧路径" --include="*.gd" .             # 旧引用全仓归零
dotnet build                                     # C# 0 错 0 警
```

- 写 ADR（背景/选项/决策/后果/回滚/验证）
- 更新工单/目录结构文档/CHANGELOG
- 偏差显式记录（本次 3 处：第 5 门面因测试直呼/class_name 移除因与 autoload 同名/运行时态归属决策）

## 决策规则速查

| 问题 | 答案 |
|------|------|
| 序列化字段（存档）迁不迁？ | ❌ 不迁，留容器（S12 红线） |
| 被测试直戳的私有 var 迁不迁？ | ❌ 留容器（var 访问自动兼容） |
| 被测试直呼的方法要不要门面？ | ✅ 必须，保名 delegate |
| 无调用者的内部函数？ | 整体移除，不设门面 |
| 引擎放哪？ | autoload/（R6：features/ 容器不可反向引用；GameState→features 会判红） |
| 注册顺序？ | 引擎在容器之后 |
| 新文件何时接线？ | 当次任务（拆了必须接线） |
| 行数超豁免？ | 写 ADR 附录豁免条款（ADR-002 附录 A 先例） |

## 验证清单（DoD）

- [ ] 基线 GUT 数量 == 重构后 GUT 数量（零新增零减少，测试零改动）
- [ ] 门面保名清单 == grep 出的外部调用面（不漏一个）
- [ ] 旧函数/旧路径全仓 grep 零残留
- [ ] check_health.py 全绿
- [ ] 新模块接线证明（autoload 注册行 / 容器持有行 / 被调用点）
- [ ] ADR 归档（含回滚步骤 + 偏差记录）
- [ ] dotnet build 0 错（如有 .cs）

## 案例实录（ADR-002 GameState 拆分，2026-08-10）

- 起点：game_state.gd 1771 行（8.9× 超限，宪法 ≤200）
- 拆分：date_utils(73) + credit_service(235) + video_engine(291) + social_engine(704)
- 终点：555 行（容器≤600 达标），GUT 290/290 全程零破坏，测试零改动，存档 73-key 扁平原样
- 偏差 3 处已记录：maybe_settle_credit 第 5 门面 / class_name 移除（与 autoload 同名冲突）/ 被直戳运行时态留容器
- 完整细节：docs/任务管理/GameState拆分迁移工单.md + docs/架构设计/ADR/ADR-002-GameState职责拆分.md
