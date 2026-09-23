#!/usr/bin/env node
/**
 * extract-kit —— 从「源项目」抽取多代理工作流 → 生成/刷新 kit 模板
 * =====================================================================
 * kit 是**派生工件**：真源是跑着的项目（`.pi/agents`、`.pi/skills`）。
 * 本脚本把源项目的工作流文件复制进 kit，并做两件事：
 *   ① 字面替换：项目路径/项目名/仓库名 → `{{占位符}}`
 *   ② 插入 pack 标记：引擎专属区段包上 `<!-- pack:godot:start/end -->`
 *      （apply-kit 落地时按所选 pack 保留或裁掉；标记行本身在输出中永远被剥掉）
 *
 * 用法：
 *   node ~/.pi/agent/kit/tools/extract-kit.mjs                  # 默认源 = D:/MyGame_journey
 *   node ~/.pi/agent/kit/tools/extract-kit.mjs --from <项目根>
 *   node ~/.pi/agent/kit/tools/extract-kit.mjs --check          # 只校验 kit 是否与源同步
 *
 * 返回码：0 = 成功/同步；1 = 失败或有漂移（--check 下漂移即 1）
 * ⚠️ 锚点漂移会**显式报错**（绝不静默跳过）——源文档改了标题就要同步改本文件的 MARKERS。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const KIT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
const argv = process.argv.slice(2);
const argVal = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const CHECK = argv.includes("--check");
const SRC = path.resolve(argVal("--from", process.env.KIT_SRC || "D:/MyGame_journey"));

/* ── ① 字面替换表（顺序敏感：长的在前） ───────────────────────────── */
const REPLACEMENTS = [
  ["D:\\MyGame_journey", "{{PROJECT_ROOT}}"],
  ["D:/MyGame_journey", "{{PROJECT_ROOT}}"],
  ["/d/MyGame_journey", "{{PROJECT_ROOT}}"],
  ["《东游记：2030》", "《{{PROJECT_NAME}}》"],
  ["JourneyToTheEast", "{{PROJECT_NAME_EN}}"],
  ["journey-to-the-east", "{{PROJECT_REPO}}"],
  ["Godot游戏设计师", "{{ENGINE}}游戏设计师"],
  ["Godot游戏架构师", "{{ENGINE}}游戏架构师"],
  ["不应碰 Godot 资源", "不应碰引擎资源"],
  ["Godot 4.7 游戏引擎", "{{ENGINE}} {{ENGINE_VERSION}}"],
  ["D:/Godot4.7", "{{GODOT_DOCS_DIR}}"],
];

/* ── ② 文件映射：src(源项目相对) → dst(kit 相对) + pack ───────────── */
const FILES = [
  // core：跨项目复用
  { src: ".pi/settings.json",                     dst: "core/pi-settings.json",                  pack: "core" },
  { src: ".pi/agents/PIPELINE.md",                dst: "core/agents/PIPELINE.md.tmpl",           pack: "core" },
  { src: ".pi/agents/coordinator.toml",           dst: "core/agents/coordinator.toml.tmpl",      pack: "core" },
  { src: ".pi/agents/designer.toml",              dst: "core/agents/designer.toml.tmpl",         pack: "core" },
  // packs/godot：引擎专属档位与工具链
  { src: ".pi/agents/architect.toml",             dst: "packs/godot/agents/architect.toml.tmpl",              pack: "godot" },
  { src: ".pi/agents/programmer.toml",            dst: "packs/godot/agents/programmer.toml.tmpl",             pack: "godot" },
  { src: ".pi/agents/tester.toml",                dst: "packs/godot/agents/tester.toml.tmpl",                 pack: "godot" },
  { src: ".pi/agents/systems-maintainer.toml",    dst: "packs/godot/agents/systems-maintainer.toml.tmpl",     pack: "godot" },
  { src: ".pi/agents/例行巡检-checklist.md",      dst: "packs/godot/agents/例行巡检-checklist.md.tmpl",       pack: "godot" },
  { src: ".mcp.json",                             dst: "packs/godot/mcp.json.tmpl",              pack: "godot" },
  { src: ".gitignore",                            dst: "packs/godot/gitignore.tmpl",             pack: "godot" },
];

/* ── ③ 技能分配 ─────────────────────────────────────────────────── */
const SKILLS_CORE = ["agent-browser", "caveman", "game-design-grill", "game-domain-modeling", "scope-check"];
const SKILLS_GODOT = ["game-architecture-review", "gdmcp", "godot-bug-hunt", "godot-docs", "godot-tdd", "map-development", "safe-refactor"];

/* ── ③b core 专属结构化改写（精确串，命中不到即报漂移） ─────────── */
const PATCHES = [
  { dst: "core/agents/PIPELINE.md.tmpl",
    from: "# Godot 游戏开发流水线使用说明书",
    to: "# 游戏开发流水线使用说明书 —— {{PROJECT_NAME}}" },
  { dst: "core/agents/PIPELINE.md.tmpl",
    from: "触碰 GameState/存档、跨场景、C# 边界、输入系统 → 至少升一档。",
    to: "触碰状态容器/存档、跨场景、跨语言边界、输入系统 → 至少升一档。" },
  { dst: "core/agents/PIPELINE.md.tmpl",
    from: "| **programmer** | read/write/edit + MCP | deepseek-flash (high) | godot-tdd, game-domain-modeling | 所有任务 |",
    to: "| **programmer** | read/write/edit + MCP | {{MODEL_HIGH}} | game-domain-modeling | 所有任务 |" },
  { dst: "core/agents/PIPELINE.md.tmpl",
    from: "| **tester** | read-only + MCP + bash | deepseek-flash (medium) | godot-tdd, godot-bug-hunt | 所有任务 |",
    to: "| **tester** | read-only + MCP + bash | {{MODEL_MEDIUM}} | （pack 技能：TDD / bug-hunt） | 所有任务 |" },
  { dst: "core/agents/PIPELINE.md.tmpl",
    from: "| **systems-maintainer** | read + bash + MCP + write/edit(仅文档资产) | deepseek-flash (high) | game-architecture-review, godot-tdd | 定期巡检/关键节点评审/复盘治理（按需） |",
    to: "| **systems-maintainer** | read + bash + MCP + write/edit(仅文档资产) | {{MODEL_HIGH}} | game-architecture-review | 定期巡检/关键节点评审/复盘治理（按需） |" },
  { dst: "core/agents/PIPELINE.md.tmpl",
    from: "**成本账（口径：以最近一次全量实测为准）**：全量 = **171 脚本 / 1884 用例 ≈ 160–213 s**；单模块 `-gselect` ≈ **5–20 s**。\n> 出处：`.pi/designs/巡检报告-2026-09-23-夜.md` §三（2026-09-23 12:35Z Coordinator 全量实测 171 脚本 / 1884 用例 / Failing 0）。\n> ⚠️ 脚本/用例数**随批次增长**（历史：2026-09-18 = 160/1718 ⇒ 09-23 = 171/1884）⇒ **禁把数字当长期不变基线**；要核对现值就跑一次全量并回写本行。\n**工具**：`powershell -File tools/run_gut.ps1 -Files <测试文件>`（定向）· `… -Full`（全量，显式）。禁用「先跑全量看看」。",
    to: "**成本账（口径：以最近一次全量实测为准）**：源项目实测 全量 ≈ **160–213 s**；单模块定向 ≈ **5–20 s**（新项目首次全量后回写本行）。\n> ⚠️ 脚本/用例数**随批次增长** ⇒ **禁把数字当长期不变基线**；要核对现值就跑一次全量并回写本行。\n**工具**：测试入口分「定向」与「全量」两个显式命令（具体命令由 pack 提供，禁用「先跑全量看看」）。" },
  { dst: "core/agents/PIPELINE.md.tmpl",
    from: "- **质量防线** — 测试全量回归 + 脚本 validate + dotnet build 门禁 + **`python tools/check_health.py` 健康门禁（每次提交 pre-commit 自动跑，见 docs/架构设计/质量门禁规范.md）**",
    to: "- **质量防线** — 测试全量回归 + 引擎脚本/资源校验 + 构建门禁 + **项目健康门禁脚本（pre-commit 自动跑；具体命令见 pack）**" },
  { dst: "core/agents/coordinator.toml.tmpl",
    from: "## 项目技术栈\n",
    to: "## 项目技术栈\n\n- 项目名：{{PROJECT_NAME}}（{{PROJECT_NAME_EN}}）· Git 仓：{{PROJECT_REPO}}\n- 引擎：{{ENGINE}} {{ENGINE_VERSION}}\n- 工具链/纪律的单一事实源 = 项目 `AGENTS.md` 宪法 + 下方引擎块\n" },
  { dst: "core/agents/coordinator.toml.tmpl",
    from: "## ⚠️ 关键约束\n",
    to: "## ⚠️ 关键约束\n\n- **引擎文件纪律**：引擎资源/场景/脚本改动走引擎 CLI 或 MCP，不直接用 write/edit 工具（见宪法 R1）\n- **构建/校验门禁**：代码变更后必须让项目构建与脚本校验通过（命令见 pack）\n- **单向依赖**：内容层 → 系统层 → 全局层，禁止反向 import\n" },
  { dst: "core/agents/coordinator.toml.tmpl",
    from: "   - **Full**：跨场景流程 / 新系统 / 存档变更 / 数值设计 / 里程碑 → designer（按需）+ architect + programmer + tester（全量 L1-L4）+ check_health + 复盘",
    to: "   - **Full**：跨场景流程 / 新系统 / 存档变更 / 数值设计 / 里程碑 → designer（按需）+ architect + programmer + tester（全量）+ 健康门禁 + 复盘" },
  { dst: "core/agents/coordinator.toml.tmpl",
    from: "   触碰 GameState/存档、跨场景、C# 边界、输入系统红线 → 至少升一档",
    to: "   触碰状态容器/存档、跨场景、跨语言边界、输入系统红线 → 至少升一档" },
  { dst: "core/agents/coordinator.toml.tmpl",
    from: "使用 MCP 工具操作场景树和脚本。C# 文件用 write/edit 工具，GDScript 文件用 MCP modify_script。完成后做基本自检。",
    to: "按 pack 的工具纪律改文件：引擎资源/场景/脚本走 MCP/CLI，纯文本源码可 write/edit。完成后做基本自检。" },
  { dst: "core/agents/coordinator.toml.tmpl",
    from: "用 MCP run_project 启动游戏测试，用 execute_editor_script 验证状态，用 get_editor_logs 检查错误。",
    to: "用 pack 提供的测试/验证通道跑起项目并检查日志（具体工具见 pack）。" },
  { dst: "core/agents/coordinator.toml.tmpl",
    from: "- C# ↔ GDScript 边界是否清楚？",
    to: "- 跨语言/跨模块边界是否清楚？" },
  { dst: "core/agents/coordinator.toml.tmpl",
    from: "输出 ADR + 场景契约 + 信号契约 + C#/GDScript 边界。",
    to: "输出 ADR + 场景契约 + 信号契约 + 跨语言/跨模块边界。" },
  { dst: "core/agents/coordinator.toml.tmpl",
    from: "  `powershell -File tools/run_gut.ps1 -Files <相关测试文件>`（≈5-20s/次，替代全量 ≈180-215s；全量现值口径见 `.pi/agents/PIPELINE.md` §测试执行分级口径）。",
    to: "  定向测试命令（≈5-20s/次，替代全量 ≈160-213s；全量口径见 `.pi/agents/PIPELINE.md` §测试执行分级口径；具体命令见 pack）。" },
  { dst: "core/agents/PIPELINE.md.tmpl",
    from: "bash 跑 `gdmcp` CLI / `run_gut.ps1`",
    to: "bash 跑引擎 CLI / 测试脚本（见 pack）" },
  { dst: "core/agents/PIPELINE.md.tmpl",
    from: "architect 产出 ADR + 场景契约 + C#/GDScript 边界定义",
    to: "architect 产出 ADR + 场景契约 + 跨语言/跨模块边界定义" },
  { dst: "core/agents/PIPELINE.md.tmpl",
    from: "programmer 根据设计实现代码，C# 优先，GDScript 其次",
    to: "programmer 根据设计实现代码（语言/文件类型策略见 pack 与项目宪法）" },
  { dst: "core/agents/PIPELINE.md.tmpl",
    from: "| **scope-check（技能）** | 只读（read/grep/find/ls/bash 只读） | —（Coordinator 内嵌调用） | scope-check | **强制**：spawn 任何子代理前 |",
    to: "| **scope-check（技能）** | 只读（read/grep/find/ls/bash 只读） | —（Coordinator 内嵌调用） | scope-check | **强制**：spawn 任何子代理前 |\n\n> 表中出现的 pack 专属技能（如架构审查 / 安全重构）由所选 pack 提供；未装该 pack 时该列技能不可用。" },
  { dst: "core/skills/scope-check/SKILL.md",
    from: "   - GameState / 存档契约变更",
    to: "   - 状态容器 / 存档契约变更" },
  { dst: "core/skills/scope-check/SKILL.md",
    from: "   - C# ↔ GDScript 边界（新 Bridge / 新 .cs）",
    to: "   - 跨语言边界（新增桥接层 / 新增源文件类型）" },
  { dst: "core/skills/scope-check/SKILL.md",
    from: "   - programmer 被要求直接编辑 .tscn/.tscn/.gd → 拦截（R1 红线）",
    to: "   - programmer 被要求绕过引擎 CLI/MCP 直接改引擎资源文件 → 拦截（R1 红线）" },
  { dst: "core/skills/scope-check/SKILL.md",
    from: "5. **成本校验**：Normal 任务书若含「全量 GUT 1101」「L4 编辑器 load」→ 降为受影响模块 + L1",
    to: "5. **成本校验**：Normal 任务书若含「全量测试」「L4 编辑器 load」→ 降为受影响模块 + L1" },
];

/* ── ③c core 词表替换（只作用于 pack 块**之外**的文本） ─────────── */
const CORE_WORDS = [
  ["`tools/check_health.py`", "健康门禁脚本"],
  ["`tools/check_*.py`", "配套门禁脚本"],
  ["check_health", "健康门禁"],
  ["全量 GUT", "全量测试"],
  ["全量 GUT 允许", "全量测试允许"],
  ["GUT 计数", "用例计数"],
  ["GameState 行数断言", "状态容器行数断言"],
  ["GameState/存档", "状态容器/存档"],
  ["`-gselect`", "定向过滤"],
  ["`gdmcp` CLI", "引擎 CLI"],
  ["gdmcp", "引擎 CLI"],
  ["run_gut.ps1", "测试脚本"],
  ["powershell -File ", ""],
  ["C# ↔ GDScript", "跨语言"],
  ["C#/GDScript", "跨语言"],
  ["dotnet build", "项目构建"],
  ["Godot 资源", "引擎资源"],
  ["Godot 操作", "引擎操作"],
  ["Godot 文件", "引擎文件"],
  ["Godot 行为", "引擎行为"],
  ["gdmcp CLI", "引擎 CLI"],
  ["MCP native 工具", "引擎 MCP 工具"],
];

/* ── ④ 区段标记规则（按文本锚点，不按行号） ─────────────────────── */
const MARKERS = [
  { dst: "core/agents/PIPELINE.md.tmpl", pack: "godot",
    start: "### 🔴 环境前置：编辑器 / gdmcp 通道", end: "## 相关技能" },
  { dst: "core/agents/PIPELINE.md.tmpl", pack: "godot",
    start: "| **环境前置（2026-09-23 加严）** |", end: "- programmer 修改前自动预留文件" },
  { dst: "core/agents/PIPELINE.md.tmpl", pack: "godot",
    start: "| game-architecture-review |", end: "| game-domain-modeling |" },
  { dst: "core/agents/PIPELINE.md.tmpl", pack: "godot",
    start: "| **safe-refactor** |", end: null },
  { dst: "core/agents/PIPELINE.md.tmpl", pack: "godot",
    start: "| CLI 优先 |", end: "| 复盘进化 |" },
  { dst: "core/agents/coordinator.toml.tmpl", pack: "godot",
    start: "- Godot 4.7 游戏引擎", end: "## ⚠️ 关键约束" },
  { dst: "core/agents/coordinator.toml.tmpl", pack: "godot",
    start: "- **CLI 优先**", end: "## 流水线阶段" },
  { dst: "core/agents/coordinator.toml.tmpl", pack: "godot",
    start: "### Godot MCP", end: "## 并行策略" },
  { dst: "core/agents/designer.toml.tmpl", pack: "godot",
    start: "## Godot MCP 工具参考", end: null /* null = 到文件尾 */ },
];

/* ── ⑤ AGENTS.md 块名台账（漂移检测；模板本体由人维护） ──────────── */
const AGENTS_BLOCKS_CORE = ["codebase-memory-mcp", "project-constitution", "caveman-default", "self-evolution"];
const AGENTS_BLOCKS_PACK = ["godot-cli-rule", "gds-csharp-hybrid", "game-state-governance"];

/* ═══════════════════════════════════════════════════════════════ */
const log = (...a) => console.log("[kit]", ...a);
const errs = [];
const written = [];
const stale = [];

function substitute(text) {
  let out = text;
  for (const [from, to] of REPLACEMENTS) out = out.split(from).join(to);
  return out;
}

function insertMarkers(dst, text) {
  const rules = MARKERS.filter((m) => m.dst === dst);
  let out = text;
  for (const rule of rules) {
    const lines = out.split("\n");
    const si = lines.findIndex((l) => l.startsWith(rule.start));
    if (si < 0) { errs.push(`锚点未命中：${dst} 起锚 "${rule.start}"（源文档改标题了？同步改 extract-kit.mjs 的 MARKERS）`); continue; }
    let ei = rule.end === null ? lines.length : lines.findIndex((l, i) => i > si && l.startsWith(rule.end));
    if (ei < 0) { errs.push(`锚点未命中：${dst} 止锚 "${rule.end}"`); continue; }
    // 表格行块：不吃尾随空行（否则保留 pack 时表格被空行断开）
    if (lines[si].trimStart().startsWith("|")) while (ei - 1 > si && lines[ei - 1].trim() === "") ei--;
    lines.splice(ei, 0, `<!-- pack:${rule.pack}:end -->`);
    lines.splice(si, 0, `<!-- pack:${rule.pack}:start -->`);
    out = lines.join("\n");
  }
  return out;
}

function walkCopy(srcDir, dstDir, transformFn) {
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, e.name), d = path.join(dstDir, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); walkCopy(s, d, transformFn); }
    else writeOut(d, transformFn(path.relative(KIT, d).replace(/\\/g, "/"), fs.readFileSync(s, "utf8")));
  }
}

function writeOut(dstAbs, text) {
  written.push(path.relative(KIT, dstAbs).replace(/\\/g, "/"));
  if (CHECK) {
    const old = fs.existsSync(dstAbs) ? fs.readFileSync(dstAbs, "utf8") : null;
    if (old !== text) stale.push(path.relative(KIT, dstAbs).replace(/\\/g, "/"));
    return;
  }
  fs.mkdirSync(path.dirname(dstAbs), { recursive: true });
  fs.writeFileSync(dstAbs, text);
}

/* ── 主流程 ─────────────────────────────────────────────────────── */
if (!fs.existsSync(path.join(SRC, ".pi/agents/PIPELINE.md"))) {
  console.error(`[kit] ✗ 源项目不像工作流源（缺 .pi/agents/PIPELINE.md）：${SRC}`);
  process.exit(1);
}
log(`源项目 = ${SRC}`);
log(`kit = ${KIT}${CHECK ? "（--check 只比对不写盘）" : ""}`);

/* 顺序：插标记 → core 结构化改写 → 占位符替换 → core 词表替换（仅块外） */
function transform(dstRel, raw) {
  let text = insertMarkers(dstRel, raw);
  for (const p of PATCHES.filter((p) => p.dst === dstRel)) {
    if (!text.includes(p.from)) { errs.push(`结构化改写未命中：${dstRel} ← "${p.from.slice(0, 50)}…"（源文档变了？同步改 extract-kit.mjs 的 PATCHES）`); continue; }
    text = text.split(p.from).join(p.to);
  }
  text = substitute(text);
  if (dstRel.startsWith("core/")) text = applyCoreWords(text);
  // 行尾统一 LF：kit 是跨平台分发物，源项目里可能混 CRLF（外部技能包/手写文件）⇒ 不统一会与 --check 假漂移
  return text.split(String.fromCharCode(13) + String.fromCharCode(10)).join(String.fromCharCode(10));
}

function splitBlocks(text) {
  const out = [];
  let rest = text, inBlock = false;
  const re = /<!--\s*pack:[a-z0-9_-]+:(start|end)\s*-->/;
  for (;;) {
    const m = rest.match(re);
    if (!m) { out.push({ text: rest, inBlock }); break; }
    out.push({ text: rest.slice(0, m.index), inBlock });
    out.push({ text: m[0], inBlock: null });
    if (m[1] === "start") inBlock = true; else inBlock = false;
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

function applyCoreWords(text) {
  return splitBlocks(text)
    .map((seg) => {
      if (seg.inBlock !== false) return seg.text; // 块内/标记行原样
      let t = seg.text;
      for (const [from, to] of CORE_WORDS) t = t.split(from).join(to);
      return t;
    })
    .join("");
}

for (const f of FILES) {
  const s = path.join(SRC, f.src);
  if (!fs.existsSync(s)) { errs.push(`源文件缺失：${f.src}`); continue; }
  writeOut(path.join(KIT, f.dst), transform(f.dst, fs.readFileSync(s, "utf8")));
}

for (const [pack, list] of [["core", SKILLS_CORE], ["godot", SKILLS_GODOT]]) {
  for (const name of list) {
    const sdir = path.join(SRC, ".pi/skills", name);
    if (!fs.existsSync(sdir)) { errs.push(`技能缺失：${name}`); continue; }
    walkCopy(sdir, path.join(KIT, pack === "core" ? "core/skills" : "packs/godot/skills", name), transform);
  }
}

// AGENTS.md 块名漂移检测（模板本体人工维护，不自动覆盖）
const agentsSrc = fs.readFileSync(path.join(SRC, "AGENTS.md"), "utf8");
const found = [...agentsSrc.matchAll(/<!--\s*([a-z0-9-]+):start\s*-->/g)].map((m) => m[1]);
const known = new Set([...AGENTS_BLOCKS_CORE, ...AGENTS_BLOCKS_PACK]);
for (const b of found) if (!known.has(b)) errs.push(`AGENTS.md 出现未知块 "${b}" → 决定它归 core 还是 pack，并登记到 extract-kit.mjs 的 AGENTS_BLOCKS_*`);
for (const b of known) if (!found.includes(b)) errs.push(`AGENTS.md 少了已知块 "${b}" → 源项目删了就同步从台账删`);

log(`写出/比对 ${written.length} 个文件（${written.filter((w) => w.startsWith("core/")).length} core · ${written.filter((w) => w.startsWith("packs/")).length} pack）`);
if (CHECK) {
  if (stale.length) { log(`✗ ${stale.length} 个文件与源不同步：\n  - ` + stale.join("\n  - ")); }
  else log("✓ kit 与源项目同步");
}
if (errs.length) { console.error("[kit] ✗\n  - " + errs.join("\n  - ")); process.exit(1); }
if (CHECK && stale.length) process.exit(1);
log("✓ 完成");
