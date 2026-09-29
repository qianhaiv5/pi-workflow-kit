#!/usr/bin/env node
/**
 * kit-lock —— kit 写权锁（跨 agent / 跨项目协作用的**轻量文件锁**）
 * =====================================================================
 * 立此动机（2026-09-29）：两个项目（各自 agent）可能同时改同一份 kit ⇒ 需要「**谁动谁 acquire**」。
 *   此前只有口头约定，没有可执行工具（对方 agent 曾以为存在 `kit-lock status` ⇒ 实测无此工具）。
 * 设计：单文件 JSON 锁 `<kit>/.kit-lock.json`（**不入库**，见 kit/.gitignore）：
 *   { holder, host, project, why, acquiredAt, ttlMin }
 *   默认 TTL 30 min：**过期锁视为「陈旧」**（不阻塞，但 status 会明确标注），避免一方掉线后永久锁死。
 *
 * 用法：
 *   node tools/kit-lock.mjs status                       # 看当前锁（无锁 / 有效 / 陈旧）
 *   node tools/kit-lock.mjs acquire --who <名> --why <事> [--project <路径>] [--ttl 30] [--force]
 *   node tools/kit-lock.mjs release --who <名> [--force]
 * 退出码：status 恒 0；acquire 被已有有效锁拒绝 ⇒ 2；release 非持锁者且无 --force ⇒ 2。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TOOLS = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const KIT = path.dirname(TOOLS);
const LOCK = path.join(KIT, ".kit-lock.json");

const argv = process.argv.slice(2);
const cmd = argv[0] || "status";
const flag = (name, def = "") => {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true") : def;
};
const has = (name) => argv.includes("--" + name);

const read = () => (fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, "utf8")) : null);
const ageMin = (iso) => (Date.now() - new Date(iso).getTime()) / 60000;
const isStale = (lb) => !!lb && ageMin(lb.acquiredAt) > (lb.ttlMin ?? 30);
const show = (lb) => {
  if (!lb) return console.log("[kit-lock] 无锁（可 acquire）");
  const age = ageMin(lb.acquiredAt).toFixed(1);
  console.log(`[kit-lock] ${isStale(lb) ? "⚠ 陈旧锁（可被 acquire 覆盖）" : "有效锁"}｜holder=${lb.holder}｜host=${lb.host}｜project=${lb.project}｜why=${lb.why}｜age=${age}min / ttl=${lb.ttlMin}min`);
};

if (cmd === "status") {
  console.log(`[kit-lock] kit = ${KIT}`);
  show(read());
  process.exit(0);
}

if (cmd === "acquire") {
  const who = flag("who");
  if (!who) {
    console.error("[kit-lock] acquire 需要 --who <名>");
    process.exit(2);
  }
  const cur = read();
  if (cur && !isStale(cur) && cur.holder !== who && !has("force")) {
    console.error(`[kit-lock] ❌ 已有有效锁：holder=${cur.holder}（age=${ageMin(cur.acquiredAt).toFixed(1)}min）。请等其 release，或确认后 --force。`);
    process.exit(2);
  }
  const lb = {
    holder: who,
    host: os.hostname(),
    project: flag("project", process.cwd()),
    why: flag("why", "(未填)"),
    acquiredAt: new Date().toISOString(),
    ttlMin: Number(flag("ttl", "30")),
  };
  fs.writeFileSync(LOCK, JSON.stringify(lb, null, 2) + "\n", "utf8");
  console.log("[kit-lock] ✅ 已 acquire");
  show(lb);
  process.exit(0);
}

if (cmd === "release") {
  const who = flag("who");
  const cur = read();
  if (!cur) {
    console.log("[kit-lock] 无锁可释放");
    process.exit(0);
  }
  if (cur.holder !== who && !has("force")) {
    console.error(`[kit-lock] ❌ 锁属 ${cur.holder}，非你（--who ${who || "(空)"}）⇒ 需 --force`);
    process.exit(2);
  }
  fs.rmSync(LOCK, { force: true });
  console.log(`[kit-lock] ✅ 已 release（原 holder=${cur.holder}）`);
  process.exit(0);
}

console.error(`[kit-lock] 未知命令：${cmd}（可用：status / acquire / release）`);
process.exit(2);
