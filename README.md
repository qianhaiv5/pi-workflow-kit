# pi-workflow-kit —— 多代理工作流工具箱

> 把「跑得很顺的一套 pi 多代理工作流」搬到**新主机 / 新项目**：core 引擎中立，引擎专属部分做成 pack。
> 装法只有一条指令，见 [`BOOTSTRAP.md`](BOOTSTRAP.md)。

## 一条指令

在新主机的 pi 里说：

```
克隆 https://github.com/qianhaiv5/pi-config-backup.git 到 ~/.pi/agent，克隆 https://github.com/qianhaiv5/pi-workflow-kit.git 到 ~/.pi/agent/kit，然后读 ~/.pi/agent/kit/BOOTSTRAP.md 并严格逐步执行
```

（本仓 = 工具箱；`pi-config-backup` = 全局配置。两仓分开 ⇒ 工作流可复用，配置含机器专属内容。）

## 目录

```
kit/
├── BOOTSTRAP.md           # 新主机 + 新项目的逐步安装书（给 pi 执行，含门禁与失败处置表）
├── README.md              # 本文件
├── core/                  # 跨项目复用（引擎中立；块内是 pack 内容，落地时按 pack 裁剪）
│   ├── AGENTS.md.tmpl     #   项目宪法模板（含 {{ENGINE_REDLINES/SELFCHECKS/BLOCKS}} 注入点）
│   ├── agents/            #   PIPELINE.md · coordinator.toml · designer.toml
│   ├── skills/            #   agent-browser · caveman · game-design-grill · game-domain-modeling · scope-check
│   ├── CONTEXT.md.tmpl · LESSONS.md.tmpl · designs-README.md
│   ├── pi-settings.json   #   → .pi/settings.json
│   └── gitattributes.tmpl · editorconfig.tmpl · gitignore.append
├── packs/
│   ├── godot/             # Godot 引擎 pack：4 个档位 toml（architect/programmer/tester/systems-maintainer）
│   │                      #   + 例行巡检 checklist + 5 个引擎技能 + mcp.json + gitignore + AGENTS.engine.md
│   └── none/              # 无引擎占位包（core 照装，引擎块留「待补」）
└── tools/
    ├── extract-kit.mjs    # 从**跑着的项目**反向刷新 kit（占位符替换 + pack 标记 + RULES 抹布局 + 漂移/绝对路径守卫）
    ├── apply-kit.mjs      # 把 core+pack 落到目标项目（占位符替换 + 块裁剪 + 引擎块注入 + 目标守卫）
    └── kit-teeth.mjs      # 牙口：32 项回归（用法/守卫/GODOT_PATH 参数化/无机器路径残留）
```

## 硬约束（误跑防护，2026-09-24 事故后加）

| 约束 | 行为 |
|---|---|
| `--target` 必填 | 缺省**不再回退 cwd**（旧版在 `~/.pi/agent` 里误跑会污染全局配置）⇒ 缺参数即 `exit 2` 且不落盘 |
| 未知/错拼参数 | 直接 `exit 2` + 打印用法（防 `--targt` 这类静默跑错） |
| 目标守卫 | 目标是 `~/.pi/agent`、或含 `settings.json`+`npm/node_modules`（看着像全局配置目录）、或**是 kit 自身所在树** ⇒ 拒写 `exit 2` |
| 退出码 | `0` 成功 · `1` 运行期错误/残留占位符 · `2` 用法错误 |
| 引擎路径 | `--godot-path` / `--godot-docs` 不给 ⇒ 落 `TODO-...` + 警告；**不猜源机布局**（旧模板把源机安装目录硬编码进 `.mcp.json`，换机必产出不存在路径） |

## 日常用法

```bash
node ~/.pi/agent/kit/tools/apply-kit.mjs --help        # 全部参数与退出码

# 预演（不落盘）
node ~/.pi/agent/kit/tools/apply-kit.mjs --target <新项目> --pack godot --dry-run

# 真装（缺的参数见 --help 提示；未给 --godot-path 会写 TODO 并警告）
node ~/.pi/agent/kit/tools/apply-kit.mjs --target <新项目> --pack godot \
  --name 中文名 --name-en EnglishName --repo git仓名 --godot-path "<Godot exe>" \
  --core-mechanic "骰池系统（属性=骰数）" --init-git
```

占位符（`apply-kit` 会全部替换，**残留即报错**）：

| 占位符 | 来源 |
|---|---|
| `{{PROJECT_NAME}}` / `{{PROJECT_NAME_EN}}` / `{{PROJECT_REPO}}` | `--name` / `--name-en` / `--repo`（默认目录名） |
| `{{PROJECT_ROOT}}` | `--root`（默认目标目录绝对路径，正斜杠） |
| `{{ENGINE}}` / `{{ENGINE_VERSION}}` | `--engine` / `--engine-version`（默认 `Godot` / `4.7`） |
| `{{MODEL_HIGH}}` / `{{MODEL_MEDIUM}}` | `--model-high` / `--model-medium`（默认取 `~/.pi/agent/settings.json` 的 `defaultModel`） |
| `{{CORE_MECHANIC}}` | `--core-mechanic`（配 `--core-mechanic-note` 会拼成「机制（备注）」） |
| `{{ARCH_LAYERING}}` | `--arch-layering` |
| `{{GODOT_PATH}}` / `{{GODOT_DOCS_DIR}}` | `--godot-path` / `--godot-docs` |
| `{{ENGINE_REDLINES}}` / `{{ENGINE_SELFCHECKS}}` / `{{ENGINE_BLOCKS}}` | pack 的 `AGENTS.engine.md` 三段（自动注入 `AGENTS.md`） |

## 维护 kit（它本身是派生物）

真源永远是**跑着的项目**（`.pi/agents` + `.pi/skills`）。项目里改完工作流后：

```bash
node ~/.pi/agent/kit/tools/extract-kit.mjs                 # 从 D:/MyGame_journey 刷新
node ~/.pi/agent/kit/tools/extract-kit.mjs --from <项目>    # 换源项目
node ~/.pi/agent/kit/tools/extract-kit.mjs --check          # 只校验同步（漂移 ⇒ exit 1）
```

- 引擎字面量、项目路径/名/仓库名的替换表、pack 标记锚点、core 的「去引擎化」改写，**全部集中在 `extract-kit.mjs` 顶部四个表**（`REPLACEMENTS` / `FILES` / `PATCHES` / `CORE_WORDS` + `MARKERS`）。
- 改完 `tools/**` 或模板**必跑牙口**：`node ~/.pi/agent/kit/tools/kit-teeth.mjs`（32/32，覆盖用法/守卫/引擎路径参数化/无机器路径残留）
- **锚点/改写未命中会硬报错**，绝不静默跳过 ⇒ 源文档改了标题就来同步这张表。
- `core/AGENTS.md.tmpl`、`CONTEXT.md.tmpl`、`LESSONS.md.tmpl`、`designs-README.md`、`packs/*/AGENTS.engine.md` 是**人工维护**的模板，`extract-kit` 不动它们（只对源项目 `AGENTS.md` 的块名做漂移检测）。

## 加一个引擎 pack

```bash
cp -r ~/.pi/agent/kit/packs/godot ~/.pi/agent/kit/packs/<engine>
# 改：4 个档位 toml 的引擎段、例行巡检 checklist、skills/、mcp.json.tmpl、AGENTS.engine.md 三段
# 再在 extract-kit.mjs 的 MARKERS 里登记新 pack 的标记（若该引擎内容也嵌在 core 文件里）
```

## 本仓就是独立仓

- **仓**：https://github.com/qianhaiv5/pi-workflow-kit （工作流工具箱，可给别的机器/团队复用）
- **本机落地位置**：`~/.pi/agent/kit/`（`pi-config-backup` 仓的工作树里，已被其 `.gitignore` 忽略 ⇒ 两仓互不干扰）
- **日常**：在本目录改 → `git add -A && git commit` → `git push origin main`
- **无 gh CLI 时建仓**（一次性，网页或 API 二选一）：
  ```bash
  # 网页：New repository → 名字 pi-workflow-kit → 不要初始化 README
  # 或 API（用 git 自己的凭据，不落盘）：
  CRED=$(printf 'protocol=https
host=github.com

' | git credential fill)
  TOKEN=$(printf '%s
' "$CRED" | sed -n 's/^password=//p')
  curl -s -X POST -H "Authorization: token $TOKEN" https://api.github.com/user/repos     -d '{"name":"pi-workflow-kit","description":"pi 多代理工作流工具箱（core + engine packs）","private":false}'
  ```

## 边界（这些不在 kit 里）

- **凭据**（`~/.pi/agent/auth.json`）、**扩展本体**（`npm/`）、**会话与协作运行态**（`sessions/`、`collaborating-agents/`）：不入库，按 BOOTSTRAP STEP 1 重装/重登录。
- **项目内容**（代码/素材/数据）与**历史交付报告**（`.pi/designs/*.md`）：属旧项目，本 kit 只给 `designs-README.md` 的索引模板。
- **引擎二进制**（`.gdmcp/`、Godot exe）：可再生工具链，新机自行安装。
