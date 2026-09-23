# BOOTSTRAP —— 新主机 / 新项目 一键安装书（给 pi 读，逐步执行）

> **用户只需在新主机的 pi 里说这一句**（`~/.pi/agent` 已存在则用第二句）：
>
> ```
> 克隆 https://github.com/qianhaiv5/pi-config-backup.git 到 ~/.pi/agent，然后读 ~/.pi/agent/kit/BOOTSTRAP.md 并严格逐步执行
> ```
> 已存在（升级/补装）：
> ```
> git -C ~/.pi/agent pull --ff-only && 读 ~/.pi/agent/kit/BOOTSTRAP.md 并从 STEP 1 起核查
> ```
> 无法用 git 时（网络受限）：`curl -fsSL https://raw.githubusercontent.com/qianhaiv5/pi-config-backup/master/kit/BOOTSTRAP.md` 先取本文件，按 STEP 0 的网络处置走。

---

## 执行纪律（给 agent）

- **逐 STEP 执行，每步的「门」不过就不许进下一步**；不许把失败当成功、不许「先跳过后面再补」。
- 每个命令都跑**真**命令并读输出，不臆测结果。命令失败 → 查 §FAIL 表 → 仍不明确就停下问用户。
- 需要用户提供的只有三样：**新项目根路径**、**项目名（中文/英文）**、**引擎可执行文件路径**（Godot 用）。其余给默认值即可。
- 全程不要修改 `~/.pi/agent/settings.json` 的文本（要用 `pi install` / `pi remove`，见 §FAIL「禁手改 settings.json」）。

---

## STEP 0 · 前提检查

```bash
node -v                 # 需 ≥ 20
git --version
pi --version            # 未安装 → npm i -g @earendil-works/pi-coding-agent
```
- **C 盘（或 npm 全局前缀所在盘）可用空间必须 ≥ 2GB**（`df -h /c` 或 `powershell -c "Get-PSDrive C"`）。不足先清盘，否则 `pi update` 会 `ENOSPC` 并留下半解压残包。
- 记录目标 pi 版本号：`PI_VER=$(pi --version)`（源机 2026-09-24 为 **0.87.1**）。

**门 0**：node/git/pi 三条命令都有正常输出 ∧ 磁盘空间 ≥ 2GB。

---

## STEP 1 · 全局配置（`~/.pi/agent`）

```bash
# 1.1 取配置仓（已存在则更新）
if [ -d ~/.pi/agent/.git ]; then git -C ~/.pi/agent pull --ff-only; \
else git clone https://github.com/qianhaiv5/pi-config-backup.git ~/.pi/agent; fi

# 1.2 装扩展 —— 必须**逐个显式**装（pi 的自动补装会静默漏掉 @baochunli/pi-collaborating-agents）
for p in pi-mcp-adapter pi-open-tui @firstpick/pi-themes-bundle pi-cache-optimizer @baochunli/pi-collaborating-agents; do
  pi install "npm:$p"
done

# 1.3 打本地补丁（十枚 A–J；脚本用 os.homedir()，与机器无关）
node ~/.pi/agent/bin/apply-collab-patches.mjs

# 1.4 凭据（不入库，clone 拿不到）：拷旧机 auth.json，或设环境变量 DEEPSEEK_API_KEY
#     cp <旧机>/auth.json ~/.pi/agent/auth.json      ← Windows 手工拷，或重新 pi 登录
```

**门 1**（四连，全部要过）：

| # | 命令 | 期望 |
|---|------|------|
| 1 | `pi --version` | 与 STEP 0 记录的版本一致 |
| 2 | `node ~/.pi/agent/bin/pi-config-check.js` | `✓ 配置体检通过`，**exit 0** |
| 3 | `pi -p ping --model zzz-no-such-model-zzz` | 只有 `Model ... not found`；**不得出现 `Failed to load extension`** |
| 4 | `node ~/.pi/agent/bin/apply-collab-patches.mjs --check` | `A…J` 全 `true` |

补核（防漏包）：
```bash
node -e "console.log(Object.keys(require(require('os').homedir()+'/.pi/agent/npm/package.json').dependencies).join(' '))"
# 期望含这 5 个：@baochunli/pi-collaborating-agents @firstpick/pi-themes-bundle pi-cache-optimizer pi-mcp-adapter pi-open-tui
```
模型连通性（有凭据时）：`pi -p "只回复 OK"` ⇒ 正常返回即通过。

---

## STEP 2 · 新项目落地（core + 引擎 pack）

先问用户三件事（其余用默认）：
1. **新项目根路径**（例 `D:/MyGame2`，目录可不存在）
2. **项目名**：中文名 + 英文名（英文名用于 `{{PROJECT_NAME_EN}}`）
3. **引擎**：默认 Godot ⇒ 再问 **Godot 可执行文件路径**（`.mcp.json` 的 `GODOT_PATH`）

```bash
mkdir -p "<新项目根>" && cd "<新项目根>"
node ~/.pi/agent/kit/tools/apply-kit.mjs \
  --target "<新项目根>" \
  --pack godot \
  --name "<中文名>" --name-en "<EnglishName>" --repo "<git仓名>" \
  --godot-path "<Godot exe 绝对路径>" \
  --core-mechanic "<核心判定机制，例：骰池系统（属性=骰数）>" \
  --core-mechanic-note "<一句话>" \
  --arch-layering "content → features → autoload" \
  --init-git
```
- 先预演可用 `--dry-run`（打印计划不落盘）。
- 非 Godot 项目：`--pack none`（core 照装，引擎块留「待补」）。
- 已存在文件默认**不覆盖**；要覆盖加 `--force`。

**门 2**（在目标目录跑）：

| # | 命令 | 期望 |
|---|------|------|
| 1 | `grep -rn "{{[A-Z_]*}}" <新项目根>` | 空（无未替换占位符） |
| 2 | `grep -rn "MyGame_journey" <新项目根>` | 空（无源项目路径泄漏） |
| 3 | `for d in .pi/skills/*/; do head -c3 $d/SKILL.md \| grep -q '^---$' \|\| echo "缺 frontmatter: $d"; done` | 空 |
| 4 | `pi`（在新项目目录起会话） | 能列出 `.pi/agents` 六个档位与 `.pi/skills` 技能；无报错 |
| 5 | `python -c "import tomllib,glob;[tomllib.load(open(f,'rb')) for f in glob.glob('.pi/agents/*.toml')]"` | 无异常（严格 TOML） |

---

## STEP 3 · 新项目的人工补充（agent 提醒用户做，别自己乱填）

1. `AGENTS.md` 复核四项：项目名 / 引擎 / 判定机制 / 架构分层；引擎红线块（E*）按新项目删改。
2. `.mcp.json` 的 `GODOT_PATH`（没给 `--godot-path` 时是 `TODO-...`）。
3. `.pi/agents/*.toml` 与 `例行巡检-checklist.md` 里若有旧项目路径/引擎命令 ⇒ 改成本项目。
4. `CONTEXT.md` 至少补「玩家状态」一节；建 `docs/术语表.md` 与首个 `docs/架构设计/ADR/ADR-001-*.md`。
5. `.githooks/pre-commit` 若引用了本项目没有的门禁脚本 ⇒ 删钩子或补脚本（`git config core.hooksPath .githooks`）。

---

## STEP 4 · 收尾

```bash
cd <新项目根> && git add -A && git commit -m "chore: kit 落地（core + godot pack）"
# 两仓推送断言（默认 = 项目仓 + ~/.pi/agent；路径不同用 PUSH_ASSERT_REPOS 或 bin/push-repos.json）
node ~/.pi/agent/bin/push-assert.mjs
```
- 断言只看两个硬事实：`git push` 的**显式退出码** + 推送后 `AHEAD == 0`。失败**先重试**（脚本内 5s/10s），仍失败 ⇒ 报告必须写明「**未推送 + AHEAD 数**」。
- 新机首次建议先落 `~/.pi/agent/bin/push-repos.json`：`{"repos":["<新项目根>","~/.pi/agent"]}`。

---

## §FAIL · 失败处置表

| 症状 | 性质 | 处置 |
|---|---|---|
| `Failed to load extension …` + `Hint: pi -ne` + **exit 1** | 模式 A：`settings.packages` 有条目在磁盘解析不到 | 先 `node ~/.pi/agent/bin/pi-config-check.js`；仍坏 → `pi -ne` 进场后 `pi config` / `pi remove`。**禁手改 settings.json 文本**（掉逗号必炸）；万不得已改完必须跑 config-check |
| 原生 Node 栈崩溃（`Node.js vX` 结尾、**无** Hint），栈里有扩展路径 | 模式 B：扩展自身 bug（异步回调用了失效 ctx） | `pi remove <src>` 或应用补丁（`apply-collab-patches.mjs`）。**与 pi 版本无关**，降级/重装不修 |
| 探针只报 `Model not found` | 正常（模型解析阶段就退出，**验不到 hook 逻辑**） | 想验补丁行为必须进真会话或隔离环境（`COLLABORATING_AGENTS_DIR=<临时> PI_AGENT_NAME=<假名> pi -p ... --model <真模型>`） |
| `~/.pi/agent/npm/package.json` 少于 5 项 | pi 自动补装**静默漏包**（实测漏 collab） | 逐个 `pi install npm:<包>`，再跑门 1 |
| `pi update` 报 `ENOSPC` / `ERR_MODULE_NOT_FOUND: node_modules/<依赖>` | C 盘满导致的**半解压**（不是版本回归） | 清盘后 `npm install -g --ignore-scripts @earendil-works/pi-coding-agent@<目标版本>` 重装；删 npm 残骸 `.pi-*`（运行中的 pi 会锁 `.node`，重启后再删） |
| `git clone/push` 连不上 github | 网络瞬断 | `push-assert` 已内建重试（5s/10s ×3）；clone 失败就重试或换镜像/代理 |
| 机器路径解析异常（找不到项目/仓） | `bin/machine-paths.mjs` 三级解析 | 跑自验 `node ~/.pi/agent/bin/machine-paths.mjs --self-test`（8/8）；仍不对就用 `PATCH_PROJECT_DIR` / `PUSH_ASSERT_REPOS` / `bin/push-repos.json` 显式指定 |
| 非 Windows 主机 | 平台的差异清单 | `bin/*.exe`（rg/fd/rtk/pi.exe）无用于该机 ⇒ 用系统 rg/fd；脚本已支持 `PI_CLI_JS` 指定 cli.js；`.gdmcp` 用 `install.sh` 版；`MSYS_NO_PATHCONV` 无需设置 |
| 想在临时目录试 pi（不污染真机） | 沙箱 | `PI_CODING_AGENT_DIR=<临时目录> pi …`；⚠️ 但 `apply-collab-patches.mjs` 写死 `os.homedir()`，要用 `USERPROFILE`/`HOME` 覆盖才能真正沙箱化 |

---

## §REF · 相关文档

- `~/.pi/agent/docs/迁移到新主机.md` —— 迁移决策/资产分层/验证证据（本文件的详版）
- `~/.pi/agent/docs/collab-扩展本地补丁.md` —— 十枚补丁逐枚说明 + 牙口用法
- `~/.pi/agent/docs/pi-版本与配置二分诊断.md` —— 模式 A/B 二分法
- `~/.pi/agent/AGENTS.md` —— 工作流记忆（本机 pi 的行为约定）
