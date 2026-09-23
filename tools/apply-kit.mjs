#!/usr/bin/env node
/**
 * apply-kit —— 把 kit（core + 选定 pack）落到一个新项目
 * =====================================================================
 * 做四件事：
 *   ① 占位符替换（项目名/根路径/仓库名/引擎/模型/工具路径 …）
 *   ② pack 块裁剪（`<!-- pack:godot:start/end -->` 内内容按所选 pack 保留或丢弃；标记行永远剥掉）
 *   ③ 引擎块注入（pack 的 `AGENTS.engine.md` 三段 → 宪法里的 `{{ENGINE_REDLINES}}` / `{{ENGINE_SELFCHECKS}}` / `{{ENGINE_BLOCKS}}`）
 *   ④ 落盘映射（`core/agents/x.toml.tmpl` → `<target>/.pi/agents/x.toml` 等）
 *
 * 用法（`--help` 打印全文）：
 *   node <kit>/tools/apply-kit.mjs --target <新项目根> [--pack godot|none] \
 *        [--name 中文名] [--name-en 英文名] [--repo git仓名] [--root 路径] \
 *        [--engine Godot] [--engine-version 4.7] [--model-high X] [--model-medium Y] \
 *        [--godot-path <exe>] [--godot-docs <dir>] [--core-mechanic X] [--core-mechanic-note Y] \
 *        [--arch-layering X] [--dry-run] [--force] [--init-git]
 *
 * `--target` **必填**（2026-09-24 修正：旧版缺省 cwd ⇒ 在 `~/.pi/agent` 里误跑会污染全局配置，已加硬拦）。
 * 幂等：默认**不覆盖**已存在文件（列出「已存在跳过」），要覆盖加 `--force`。
 * 退出码：0 成功；1 运行期错误/残留占位符；2 用法错误（缺 --target / 未知参数 / 拒写全局配置目录）。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const KIT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const val = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };

const USAGE = `apply-kit —— 把 kit（core + 选定 pack）落到一个新项目

必填：
  --target <目录>          新项目根（必填；不默认 cwd，防污染全局配置目录）

可选：
  --pack <godot|none>      引擎包（默认 godot）
  --name / --name-en       项目中文名 / 英文名（默认取目录名）
  --repo <git仓名>         项目仓名（默认取目录名）
  --root <路径>            写入文档的绝对根路径（默认 = --target 实解析值）
  --engine / --engine-version   引擎与版本（默认 Godot / 4.7）
  --model-high / --model-medium 档位模型名（默认取 ~/.pi/agent/settings.json 的 defaultModel）
  --godot-path <exe>       Godot 可执行文件（写入 .mcp.json；不给则落 TODO 并警告）
  --godot-docs <目录>      Godot 文档目录（godot-docs 技能用；不给则落 TODO 并警告）
  --core-mechanic X       项目宪法「判定」行；--core-mechanic-note Y 会拼成「X（Y）」
  --arch-layering X       项目宪法「架构」行（默认 content → features → autoload）
  --dry-run               只打印计划，不落盘
  --force                 覆盖已存在文件（默认跳过）
  --init-git              目标无 .git 时跑 git init
  -h, --help              打印本说明

退出码：0 成功 · 1 运行期错误/残留占位符 · 2 用法错误
`;

const KNOWN_FLAGS = new Set([
  "--target", "--pack", "--name", "--name-en", "--repo", "--root", "--engine", "--engine-version",
  "--model-high", "--model-medium", "--godot-path", "--godot-docs", "--core-mechanic", "--core-mechanic-note",
  "--arch-layering", "--dry-run", "--force", "--init-git", "--help", "-h",
]);

if (has("--help") || has("-h")) { console.log(USAGE); process.exit(0); }
for (const a of argv) {
  if (!a.startsWith("-")) continue;
  const name = a.split("=")[0];
  if (!KNOWN_FLAGS.has(name)) {
    console.error(`[kit] ✗ 未知参数 \`${name}\`（错拼会静默跑错目标，故硬拦）\n` + USAGE);
    process.exit(2);
  }
}

const targetArg = val("--target", "");
if (!targetArg) {
  console.error("[kit] ✗ 必须显式给 `--target <目录>`（旧版缺省会写 cwd；在 ~/.pi/agent 里误跑会污染全局配置）\n" + USAGE);
  process.exit(2);
}

const DRY = has("--dry-run");
const FORCE = has("--force");
const PACK = val("--pack", "godot");
const TARGET = path.resolve(targetArg);
const AGENT_DIR = path.join(os.homedir(), ".pi", "agent");

/* 硬拦：不把项目模板往 pi 全局配置目录（或其祖先，如 ~/.pi、~、kit 所在树）里写 */
const looksLikeAgentDir = (p) =>
  fs.existsSync(path.join(p, "settings.json")) && fs.existsSync(path.join(p, "npm", "node_modules"));
const guardHit = (() => {
  const norm = (p) => path.resolve(p).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  const t = norm(TARGET);
  if (t === norm(AGENT_DIR)) return "目标就是 pi 全局配置目录 ~/.pi/agent";
  if (looksLikeAgentDir(TARGET)) return "目标含 settings.json + npm/node_modules，看着像 pi 全局配置目录";
  const kit = norm(KIT);
  if (kit === t || kit.startsWith(t + "/")) return `目标 ${TARGET} 是 kit 自身所在树（会覆盖工具箱）`;
  return null;
})();
if (guardHit) {
  console.error(`[kit] ✗ 拒写：${guardHit}\n` +
    `[kit]    本项目模板只能落到**新项目目录**（如 D:/MyGame2）。若确要指向别处，先手动 mkdir 且确认那里不是全局配置。\n` +
    `[kit]    （本检查由 2026-09-24 误跑事故加入：旧版 --target 缺省 cwd ⇒ 一次误跑污染了 ~/.pi/agent）`);
  process.exit(2);
}

const BASENAME = path.basename(TARGET);
const POSIX_ROOT = TARGET.replace(/\\/g, "/");

const agentSettings = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), ".pi/agent/settings.json"), "utf8")); } catch { return {}; }
})();
const defaultModel = agentSettings.defaultModel || "deepseek-flash";
const godotPath = val("--godot-path", "");

const VARS = {
  PROJECT_NAME: val("--name", BASENAME),
  PROJECT_NAME_EN: val("--name-en", BASENAME),
  PROJECT_REPO: val("--repo", BASENAME),
  PROJECT_ROOT: val("--root", POSIX_ROOT),
  ENGINE: val("--engine", "Godot"),
  ENGINE_VERSION: val("--engine-version", "4.7"),
  MODEL_HIGH: val("--model-high", defaultModel),
  MODEL_MEDIUM: val("--model-medium", defaultModel),
  CORE_MECHANIC: (() => {
    const m = val("--core-mechanic", "（待填：核心判定机制）");
    const note = val("--core-mechanic-note", "");
    return note ? `${m}（${note}）` : m;
  })(),
  ARCH_LAYERING: val("--arch-layering", "content → features → autoload"),
  GODOT_PATH: godotPath || "TODO-填-Godot-可执行文件路径",
  GODOT_DOCS_DIR: val("--godot-docs", "TODO-填-Godot-文档目录"),
  DATE: new Date().toISOString().slice(0, 10),
};

const warns = [];
const errors = [];
if (!godotPath && PACK === "godot") warns.push("未给 --godot-path：`.mcp.json` 的 GODOT_PATH 写成 TODO，装完必须手工改");
if (!has("--godot-docs") && PACK === "godot") warns.push("未给 --godot-docs：godot-docs 技能的文档目录写成 TODO（不猜源机布局）");
if (!has("--name")) warns.push(`未给 --name：默认用目录名「${VARS.PROJECT_NAME}」，宪法里的项目名要复核`);
if (VARS.CORE_MECHANIC.startsWith("（待填")) warns.push("未给 --core-mechanic：宪法「判定」行是占位，装完必须手工改");
if (!fs.existsSync(KIT)) errors.push(`kit 目录不存在：${KIT}`);

/* ── 占位符 & pack 块 ─────────────────────────────────────────── */
const sub = (t) => t.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (k in VARS ? VARS[k] : m));

function pruneBlocks(text) {
  const re = /<!--\s*pack:([a-z0-9_-]+):start\s*-->[\s\S]*?<!--\s*pack:\1:end\s*-->\n?/g;
  let out = text.replace(re, (m, p) => (p === PACK ? m.replace(/<!--\s*pack:[^>]*-->\n?/g, "") : ""));
  out = out.replace(/<!--\s*pack:[^>]*-->\n?/g, ""); // 残留的单边标记
  return out;
}

function slice(file, name) {
  if (!fs.existsSync(file)) { errors.push(`pack 缺文件：${file}`); return ""; }
  const t = fs.readFileSync(file, "utf8");
  const m = t.match(new RegExp(`<!--\\s*${name}:start\\s*-->\\n?([\\s\\S]*?)<!--\\s*${name}:end\\s*-->`));
  if (!m) { errors.push(`${file} 缺区段 ${name}`); return ""; }
  return m[1].replace(/\s+$/, "\n");
}

/* ── 落盘计划 ─────────────────────────────────────────────────── */
const plan = []; // {from, to, kind}
const rd = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []);
const REG = (dstKind) => dstKind;

function addCore() {
  const c = path.join(KIT, "core");
  plan.push({ from: path.join(c, "pi-settings.json"), to: ".pi/settings.json", kind: REG("json") });
  plan.push({ from: path.join(c, "AGENTS.md.tmpl"), to: "AGENTS.md", kind: "constitution" });
  plan.push({ from: path.join(c, "CONTEXT.md.tmpl"), to: "CONTEXT.md", kind: REG("md") });
  plan.push({ from: path.join(c, "LESSONS.md.tmpl"), to: "LESSONS.md", kind: REG("md") });
  plan.push({ from: path.join(c, "designs-README.md"), to: ".pi/designs/README.md", kind: REG("md") });
  plan.push({ from: path.join(c, "gitattributes.tmpl"), to: ".gitattributes", kind: REG("text") });
  plan.push({ from: path.join(c, "editorconfig.tmpl"), to: ".editorconfig", kind: REG("text") });
  plan.push({ from: path.join(c, "gitignore.append"), to: ".gitignore", kind: "append" });
  for (const e of rd(path.join(c, "agents"))) if (e.isFile()) plan.push({ from: path.join(c, "agents", e.name), to: `.pi/agents/${e.name.replace(/\.tmpl$/, "")}`, kind: REG("text") });
  for (const e of rd(path.join(c, "skills"))) if (e.isDirectory()) for (const f of rd(path.join(c, "skills", e.name))) if (f.isFile())
    plan.push({ from: path.join(c, "skills", e.name, f.name), to: `.pi/skills/${e.name}/${f.name}`, kind: REG("text") });
}

function addPack() {
  const p = path.join(KIT, "packs", PACK);
  if (!fs.existsSync(p)) { errors.push(`pack 不存在：${PACK}（可选：${rd(path.join(KIT, "packs")).map((e) => e.name).join(", ")}）`); return; }
  for (const e of rd(path.join(p, "agents"))) if (e.isFile()) plan.push({ from: path.join(p, "agents", e.name), to: `.pi/agents/${e.name.replace(/\.tmpl$/, "")}`, kind: REG("text") });
  for (const e of rd(path.join(p, "skills"))) if (e.isDirectory()) for (const f of rd(path.join(p, "skills", e.name))) if (f.isFile())
    plan.push({ from: path.join(p, "skills", e.name, f.name), to: `.pi/skills/${e.name}/${f.name}`, kind: REG("text") });
  if (fs.existsSync(path.join(p, "mcp.json.tmpl"))) plan.push({ from: path.join(p, "mcp.json.tmpl"), to: ".mcp.json", kind: REG("json") });
  if (fs.existsSync(path.join(p, "gitignore.tmpl"))) plan.push({ from: path.join(p, "gitignore.tmpl"), to: ".gitignore", kind: "append" });
}

addCore();
addPack();
if (errors.length) { console.error("[kit] ✗ " + errors.join("\n[kit] ✗ ")); process.exit(1); }

/* ── 执行 ─────────────────────────────────────────────────────── */
const engineFile = path.join(KIT, "packs", PACK, "AGENTS.engine.md");
const INJ = {
  ENGINE_REDLINES: slice(engineFile, "redlines").trimEnd(),
  ENGINE_SELFCHECKS: slice(engineFile, "selfchecks").trimEnd(),
  ENGINE_BLOCKS: slice(engineFile, "blocks").trimEnd(),
};

const written = [], skipped = [], appended = [], leftOvers = [];
for (const it of plan) {
  const toAbs = path.join(TARGET, it.to);
  if (it.kind === "append") {
    const block = fs.readFileSync(it.from, "utf8");
    if (DRY) { appended.push(it.to); continue; }
    fs.mkdirSync(path.dirname(toAbs), { recursive: true });
    fs.appendFileSync(toAbs, block);
    appended.push(it.to);
    continue;
  }
  if (fs.existsSync(toAbs) && !FORCE) { skipped.push(it.to); continue; }
  let text = fs.readFileSync(it.from, "utf8");
  text = sub(pruneBlocks(text));
  if (it.kind === "constitution") text = sub(text.replace(/\{\{ENGINE_REDLINES\}\}/, INJ.ENGINE_REDLINES).replace(/\{\{ENGINE_SELFCHECKS\}\}/, INJ.ENGINE_SELFCHECKS).replace(/\{\{ENGINE_BLOCKS\}\}/, INJ.ENGINE_BLOCKS));
  for (const m of text.matchAll(/\{\{[A-Z0-9_]+\}\}/g)) leftOvers.push(`${it.to}: ${m[0]}`);
  if (!DRY) { fs.mkdirSync(path.dirname(toAbs), { recursive: true }); fs.writeFileSync(toAbs, text); }
  written.push(it.to);
}

if (has("--init-git") && !DRY && !fs.existsSync(path.join(TARGET, ".git"))) {
  const { execSync } = await import("node:child_process");
  try { execSync("git init -q", { cwd: TARGET }); written.push(".git/ (git init)"); } catch (e) { warns.push(`git init 失败：${e.message}`); }
}

/* ── 报告 ─────────────────────────────────────────────────────── */
console.log(`[kit] target = ${TARGET}`);
console.log(`[kit] pack   = ${PACK}（core ${plan.filter((p) => p.from.includes(`${path.sep}core${path.sep}`)).length} 文件 · pack ${plan.filter((p) => p.from.includes(`${path.sep}packs${path.sep}`)).length} 文件）`);
console.log(`[kit] ${DRY ? "（--dry-run 未落盘）" : ""}写入 ${written.length} · 追加 ${appended.length} · 跳过已存在 ${skipped.length}`);
if (written.length) console.log("[kit]   写入: " + written.join(" · "));
if (appended.length) console.log("[kit]   追加: " + appended.join(" · "));
if (skipped.length) console.log("[kit]   跳过（已存在，要覆盖加 --force）: " + skipped.join(" · "));
if (leftOvers.length) { console.error("[kit] ✗ 还有未替换占位符：\n  - " + leftOvers.join("\n  - ")); }
if (warns.length) console.log("[kit] ⚠️  " + warns.join("\n[kit] ⚠️  "));

console.log(`
[kit] 下一步（必做）：
  1. 复核 ${path.join(TARGET, "AGENTS.md")} 的「项目/引擎/判定/架构」四行与引擎块
  2. 手工补充 ${PACK === "godot" ? "`.mcp.json` 的 GODOT_PATH / `.pi/agents/*.toml` 里的项目路径" : "`.pi/agents/*.toml` 里的引擎段"}
  3. 建首个 ADR + 填 CONTEXT.md 术语（至少玩家状态一节）
  4. 验证：cd ${TARGET} && pi        # 新会话应能看到 .pi/agents 档位与 .pi/skills 技能
  5. git init / 接远端，然后按项目宪法跑一次「交付前自检」`);

if (leftOvers.length || errors.length) process.exit(1);
