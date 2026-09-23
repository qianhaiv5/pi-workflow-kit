---
name: scope-check
description: 任务分级范围审计（只读拦截）。Coordinator 在 spawn 任何子代理（architect/programmer/tester/designer）之前必须强制调用。验证任务档位（Lite/Normal/Full）与子代理任务书范围是否匹配，不通过则禁止继续并提示人工介入。P1.5 执行保障机制（2026-08-28 精简工作流新增）。
---

# Scope Check — 任务分级范围审计

## 触发时机（强制，不可跳过）

Coordinator 在 **spawn 任何子代理之前**（architect / programmer / tester / designer），必须先行调用本审计：
1. 输入：玩家任务描述 + Coordinator 判定的档位 + 准备下发的任务书
2. 审计清单逐项过
3. 输出 ✅ PASS 或 ❌ FAIL
4. FAIL → 修正任务书或升/降档后重新审计；仍 FAIL → 请求人工介入

## 分级决策表（与 PIPELINE.md 同步，单一事实源）

| 任务类型 | 档位 | 子代理流程 |
|---------|------|-----------|
| Bug 修复 / 纯 UI 调整 / 性能优化 / 代码重构 / 文档 / 简单节点脚本增删 | **Lite** | programmer 直做（**无** architect / tester）→ 自检 + 受影响模块单测 |
| 新功能（单场景内）/ 新模块（无存档交互） | **Normal** | architect → programmer → tester（**仅受影响模块 + L1**，不跑全量） |
| 跨场景流程 / 新系统 / 存档变更 / 数值设计 / 性能里程碑 | **Full** | designer（按需）→ architect → programmer → tester（**全量 L1-L4**）→ 健康门禁 + 复盘 |

## 审计清单（逐项检查）

1. **分级匹配**：任务描述落在决策表哪一行？Coordinator 判定的档位是否一致？
   - 偏低（如 Normal 任务判成 Lite）→ 漏架构/漏测试，拦截
   - 偏高（如 Bug 修复判成 Full）→ 浪费 token，降档
2. **任务书越界**：
   - Lite 任务书含「ADR」「设计文档」「全量回归」「阶段 0.5」→ 越界
   - Normal 任务书含「全量回归」「L2-L4 全跑」→ 降为受影响模块
   - Full 任务书砍掉必要产出（ADR/契约/复盘）→ 越界
3. **红线升档**：任务触碰以下任一 → **至少升一档**：
   - 状态容器 / 存档契约变更
   - 跨场景流程（场景切换、全局状态）
   - 跨语言边界（新增桥接层 / 新增源文件类型）
   - 输入系统 / 手势 / 全屏控件点击
   - 数值设计、新玩法机制
4. **工具约束**：任务书是否要求子代理使用其无权限工具？
   - tester 被要求 write/edit → 拦截
   - architect 被要求写文件 → 拦截（architect 只读）
   - programmer 被要求绕过引擎 CLI/MCP 直接改引擎资源文件 → 拦截（R1 红线）
5. **成本校验**：Normal 任务书若含「全量测试」「L4 编辑器 load」→ 降为受影响模块 + L1

## 输出格式（必须完整返回 Coordinator）

```
## SCOPE-CHECK 审计结果
- 任务：[一句话描述]
- 判定档位：[Lite/Normal/Full]（依据：决策表第 X 行）
- Coordinator 分级：[Lite/Normal/Full]
- 任务书越界项：[无 / 列出]
- 红线触碰：[无 / 列出 → 升档至 X]
- 结论：✅ PASS 放行 / ❌ FAIL 拦截
- 建议动作：[修正任务书 / 升档 / 降档 / 人工介入]
```

## 铁律

- **只读**：禁止 write/edit。发现越界 → 输出 FAIL + 建议，由 Coordinator 修正后重审
- **FAIL 禁止静默放行**：Coordinator 不得在审计 FAIL 后忽略结果继续 spawn
- **本技能是逻辑硬拦截**，不依赖底层 Hook 机制（2026-08-28 精简工作流 P1.5）
- 分级决策表以 PIPELINE.md 为准；两侧不同步时先修文档再审计
