#!/usr/bin/env node
/**
 * kit-teeth —— 工具箱的牙口（回归测试）
 * =====================================================================
 * 钉住 2026-09-24 两起真实缺陷（用户反馈）：
 *   ① apply-kit 无 `--help`、且 `--target` 缺省 = cwd ⇒ 在 `~/.pi/agent` 里误跑**污染全局配置**。
 *   ② `packs/godot/mcp.json.tmpl` 里 GODOT_PATH 硬编码源机布局
 *      （`<docs>/Godot_v4.7.1-stable_mono_win64/…exe`）⇒ 换机必产出**不存在的路径**。
 *
 * 用法：node <kit>/tools/kit-teeth.mjs
 * 退出码：0 全过；1 有 FAIL
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const TOOLS = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const KIT = path.dirname(TOOLS);
const APPLY = path.join(TOOLS, "apply-kit.mjs");
const EXTRACT = path.join(TOOLS, "extract-kit.mjs");

const results = [];
const check = (name, cond, extra = "") => { results.push([name, !!cond, extra]); };
const run = (args, opts = {}) => spawnSync(process.execPath, [APPLY, ...args], { encoding: "utf8", ...opts });

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "kit-teeth-"));
const abs = [];
const mk = (p) => { fs.mkdirSync(p, { recursive: true }); return p; };
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.name === ".git") continue;
    if (e.isDirectory()) walk(f, out); else out.push(f);
  }
  return out;
};
const ABS_RE = /(^|[^\w\]}>"'`])([A-Za-z]:[\\/][^\s"'`,()\]]*)/g;
const ABS_ALLOW = ["D:/tmp"];
/** dir 内外的机器绝对路径（白名单 = D:/tmp 约定 + 目标目录自身，因为 {{PROJECT_ROOT}} 就是它） */
const norm = (s) => { let v = s.split("\\").join("/").toLowerCase(); while (v.endsWith("/")) v = v.slice(0, -1); return v; };
const absPathsIn = (dir) => {
  const allow = [...ABS_ALLOW.map(norm), norm(path.resolve(dir))];
  const hits = [];
  for (const f of walk(dir)) {
    let t; try { t = fs.readFileSync(f, "utf8"); } catch { continue; }
    for (const m of t.matchAll(ABS_RE)) {
      const v = norm(m[2]);
      if (allow.some((p) => v.startsWith(p))) continue;
      hits.push(`${path.relative(dir, f)}: ${m[2]}`);
    }
  }
  return hits;
};

/** 源机字面量（本项才是缺陷本体的判据） */
const SRC_LITERALS = ["MyGame_journey", "D:/Godot", "Godot_v4"];
/** 把目标目录自身的两种写法抹掉再查源机字面量（{{PROJECT_ROOT}} 就是目标目录） */
const stripTarget = (s, target) => s.split(target).join("").split(target.split("/").join("\\")).join("");

try {
  /* ── ① --help / 用法错误 ────────────────────────────────────── */
  {
    const r = run(["--help"]);
    check("TC01 --help 退出码 0", r.status === 0, `exit=${r.status}`);
    check("TC02 --help 含用法关键字段", /--target/.test(r.stdout) && /退出码/.test(r.stdout));
  }
  {
    const cwd = mk(path.join(TMP, "cwd-required"));
    const r = run([], { cwd });
    check("TC03 缺 --target ⇒ exit 2", r.status === 2, `exit=${r.status}`);
    check("TC04 缺 --target 时**不落盘**（旧版会写 cwd）", walk(cwd).length === 0, `写了 ${walk(cwd).length} 个文件`);
  }
  {
    const cwd = mk(path.join(TMP, "cwd-typo"));
    const r = run(["--targt", "x"], { cwd });
    check("TC05 未知/错拼参数 ⇒ exit 2", r.status === 2, `exit=${r.status}`);
    check("TC06 错拼时不落盘", walk(cwd).length === 0);
  }

  /* ── ⑵ 拒写全局配置目录（本次事故本体） ───────────────────── */
  {
    const fake = mk(path.join(TMP, "fake-agent"));
    fs.writeFileSync(path.join(fake, "settings.json"), "{}");
    mk(path.join(fake, "npm", "node_modules"));
    const r = run(["--target", fake]);
    check("TC07 目标像 pi 全局配置目录 ⇒ exit 2", r.status === 2, `exit=${r.status}`);
    check("TC08 拒写后目标无新增 .pi/AGENTS.md", !fs.existsSync(path.join(fake, ".pi")) && !fs.existsSync(path.join(fake, "AGENTS.md")));
    check("TC09 拒写理由写明「全局配置」", /全局配置/.test(r.stderr));
  }
  {
    const r = run(["--target", path.join(os.homedir(), ".pi", "agent")]);
    check("TC10 显式指向 ~/.pi/agent ⇒ exit 2", r.status === 2, `exit=${r.status}`);
  }
  {
    const r = run(["--target", KIT]);
    check("TC11 目标 = kit 自身树 ⇒ exit 2", r.status === 2, `exit=${r.status}`);
  }

  /* ── ⑶ GODOT_PATH 参数化（不得带源机布局） ─────────────────── */
  {
    const t = mk(path.join(TMP, "godot-nopath"));
    const r = run(["--target", t, "--pack", "godot", "--name", "T1"]);
    check("TC12 不给 --godot-path ⇒ exit 0 但有待办", r.status === 0, `exit=${r.status}`);
    const mcp = JSON.parse(fs.readFileSync(path.join(t, ".mcp.json"), "utf8"));
    const gp = mcp.mcpServers["godot-mcp-runtime"].env.GODOT_PATH;
    check("TC13 GODOT_PATH 落 TODO", gp.startsWith("TODO"), gp);
    check("TC14 生成物**不得**出现源机布局 Godot_v4…", !/Godot_v4/.test(JSON.stringify(mcp)), gp);
    check("TC15 警告提示必须补 --godot-path", /--godot-path/.test(r.stdout));
    check("TC16 生成项目内无机器绝对路径（白名单外）", absPathsIn(t).length === 0, absPathsIn(t).join(" | "));
    const body = stripTarget(walk(t).map((f) => fs.readFileSync(f, "utf8")).join(String.fromCharCode(10)), t);
    check("TC16b 生成项目内无源机字面量", !SRC_LITERALS.some((s) => body.includes(s)), SRC_LITERALS.filter((s) => body.includes(s)).join(" | "));
  }
  {
    const t = mk(path.join(TMP, "godot-path-given"));
    const exe = "Q:/EngineX/bin/EngineX.exe";
    const r = run(["--target", t, "--pack", "godot", "--name", "T2", "--godot-path", exe]);
    const mcp = JSON.parse(fs.readFileSync(path.join(t, ".mcp.json"), "utf8"));
    const gp = mcp.mcpServers["godot-mcp-runtime"].env.GODOT_PATH;
    check("TC17 --godot-path 逐字注入（断值不断非空）", gp === exe, `得到 ${gp}`);
    check("TC18 该轮无 --godot-path 警告", !/未给 --godot-path/.test(r.stdout));
    check("TC19 注入后也提示了 --godot-docs 待办", /未给 --godot-docs/.test(r.stdout));
  }

  /* ── ④ 通用：占位符/标记/引擎块 ────────────────────────────── */
  {
    const t = mk(path.join(TMP, "pack-none"));
    const r = run(["--target", t, "--pack", "none", "--name", "T3"]);
    check("TC20 --pack none ⇒ exit 0", r.status === 0, `exit=${r.status}`);
    const files = walk(t);
    check("TC21 none 包不含引擎技能", !files.some((f) => /skills[\\/](godot|gdmcp|map-development)/.test(f)), files.length + " 文件");
    check("TC22 none 包引擎块标「待补」", /待补/.test(fs.readFileSync(path.join(t, "AGENTS.md"), "utf8")));
    check("TC23 none 包无机器绝对路径", absPathsIn(t).length === 0, absPathsIn(t).join(" | "));
    const body2 = stripTarget(walk(t).map((f) => fs.readFileSync(f, "utf8")).join(String.fromCharCode(10)), t);
    check("TC23b none 包无源机字面量", !SRC_LITERALS.some((s) => body2.includes(s)), SRC_LITERALS.filter((s) => body2.includes(s)).join(" | "));
    const all = files.filter((f) => /\.(md|toml|json|mjs|txt|gitattributes|editorconfig)$/.test(f) || !path.extname(f));
    const leftovers = all.flatMap((f) => [...fs.readFileSync(f, "utf8").matchAll(/\{\{[A-Z0-9_]+\}\}/g)].map((m) => `${path.relative(t, f)}: ${m[0]}`));
    check("TC24 无未替换占位符", leftovers.length === 0, leftovers.join(" | "));
    check("TC25 无 pack 标记残留", !all.some((f) => /pack:[a-z]+:(start|end)/.test(fs.readFileSync(f, "utf8"))));
  }
  {
    const t = mk(path.join(TMP, "dry-run"));
    const r = run(["--target", t, "--pack", "godot", "--dry-run"]);
    check("TC26 --dry-run 不落盘", walk(t).length === 0 && r.status === 0, `exit=${r.status} 文件 ${walk(t).length}`);
  }

  /* ── ⑤ 守卫本身：kit 源内不得有机器绝对路径（extract-kit 同款扫描） ── */
  {
    const hits = absPathsIn(path.join(KIT, "core")).concat(absPathsIn(path.join(KIT, "packs")));
    check("TC27 kit core/packs 无机器绝对路径（白名单外）", hits.length === 0, hits.join(" | "));
    const mcpT = fs.readFileSync(path.join(KIT, "packs", "godot", "mcp.json.tmpl"), "utf8");
    check("TC28 mcp.json.tmpl 只含 {{GODOT_PATH}} 占位", /"GODOT_PATH"\s*:\s*"\{\{GODOT_PATH\}\}"/.test(mcpT));
    check("TC29 mcp.json.tmpl 无源机布局残留", !/Godot_v4/.test(mcpT));
  }
  {
    /* 源可移植性（2026-09-26 修）：默认源是**源机路径**（D:/MyGame_journey）⇒ 新机器上必然
       「不像工作流源」而假红。改为：KIT_SRC 优先；源不可用时如实 **SKIP**（不是 FAIL），
       并给出「置 KIT_SRC=<跑着的项目根> 后再验」的指引。 */
    const src = process.env.KIT_SRC || "D:/MyGame_journey";
    const srcOk = fs.existsSync(path.join(src, ".pi", "agents", "PIPELINE.md"));
    if (!srcOk) {
      check("TC30 extract-kit --check 通过（kit 与源同步）", true,
        `SKIP：本机无工作流源（${src} 缺 .pi/agents/PIPELINE.md）⇒ 置 KIT_SRC=<项目根> 后再验`);
    } else {
      const r = spawnSync(process.execPath, [EXTRACT, "--check", "--from", src], { encoding: "utf8" });
      check("TC30 extract-kit --check 通过（kit 与源同步）", r.status === 0, `exit=${r.status} ${(r.stdout + r.stderr).split("\n").filter((l) => /不同步|✗/.test(l)).join(" ")}`);
    }
  }
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}

for (const [n, ok, extra] of results) console.log(`${ok ? "OK  " : "FAIL"} ${n}${extra ? "  -> " + extra : ""}`);
const fail = results.filter(([, ok]) => !ok).length;
console.log(`\n结果：pass=${results.length - fail} fail=${fail}`);
process.exit(fail ? 1 : 0);
