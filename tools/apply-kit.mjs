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
 * 用法：
 *   node ~/.pi/agent/kit/tools/apply-kit.mjs --target <新项目根> [--pack godot|none] \
 *        [--name 中文名] [--name-en 英文名] [--repo git仓名] [--root 路径] \
 *        [--engine Godot] [--engine-version 4.7] [--model-high X] [--model-medium Y] \
 *        [--godot-path <exe>] [--godot-docs <dir>] [--dry-run] [--force] [--init-git]
 *
 * 幂等：默认**不覆盖**已存在文件（列出「已存在跳过」），要覆盖加 `--force`。
 * 退出码：0 成功；1 有错误或缺必填项（--dry-run 下同样返回 1 便于先试）。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const KIT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const val = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };

const DRY = has("--dry-run");
const FORCE = has("--force");
const PACK = val("--pack", "godot");
const TARGET = path.resolve(val("--target", process.cwd()));
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
  GODOT_DOCS_DIR: val("--godot-docs", godotPath ? path.dirname(godotPath).replace(/\\/g, "/") : "TODO-填-Godot-文档目录"),
  DATE: new Date().toISOString().slice(0, 10),
};

const warns = [];
const errors = [];
if (!godotPath && PACK === "godot") warns.push("未给 --godot-path：`.mcp.json` 的 GODOT_PATH 写成 TODO，装完必须手工改");
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
