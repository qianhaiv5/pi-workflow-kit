# pi-workflow-kit —— 多代理工作流工具箱

> 把「跑得很顺的一套 pi 多代理工作流」搬到**新主机 / 新项目**：core 引擎中立，引擎专属部分做成 pack。
> 装法只有一条指令，见 [`BOOTSTRAP.md`](BOOTSTRAP.md)。

## 一条指令

在新主机的 pi 里说：

```
克隆 https://github.com/qianhaiv5/pi-config-backup.git 到 ~/.pi/agent，然后读 ~/.pi/agent/kit/BOOTSTRAP.md 并严格逐步执行
```

（kit 随全局配置仓一起来；也可把本目录拆成独立仓，见 §拆成独立仓。）

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
    ├── extract-kit.mjs    # 从**跑着的项目**反向刷新 kit（占位符替换 + pack 标记 + 漂移检测）
    └── apply-kit.mjs      # 把 core+pack 落到目标项目（占位符替换 + 块裁剪 + 引擎块注入）
```

## 日常用法

```bash
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
- **锚点/改写未命中会硬报错**，绝不静默跳过 ⇒ 源文档改了标题就来同步这张表。
- `core/AGENTS.md.tmpl`、`CONTEXT.md.tmpl`、`LESSONS.md.tmpl`、`designs-README.md`、`packs/*/AGENTS.engine.md` 是**人工维护**的模板，`extract-kit` 不动它们（只对源项目 `AGENTS.md` 的块名做漂移检测）。

## 加一个引擎 pack

```bash
cp -r ~/.pi/agent/kit/packs/godot ~/.pi/agent/kit/packs/<engine>
# 改：4 个档位 toml 的引擎段、例行巡检 checklist、skills/、mcp.json.tmpl、AGENTS.engine.md 三段
# 再在 extract-kit.mjs 的 MARKERS 里登记新 pack 的标记（若该引擎内容也嵌在 core 文件里）
```

## 拆成独立仓（可选）

```bash
cd ~/.pi/agent
git subtree split -P kit -b kit-solo      # 生成只含 kit 的分支
git push <kit-remote-url> kit-solo:main   # 推到新仓（如 qianhaiv5/pi-workflow-kit）
```
拆出后 BOOTSTRAP 的第 0 步改成先 clone kit 仓即可，其余步骤不变。

## 边界（这些不在 kit 里）

- **凭据**（`~/.pi/agent/auth.json`）、**扩展本体**（`npm/`）、**会话与协作运行态**（`sessions/`、`collaborating-agents/`）：不入库，按 BOOTSTRAP STEP 1 重装/重登录。
- **项目内容**（代码/素材/数据）与**历史交付报告**（`.pi/designs/*.md`）：属旧项目，本 kit 只给 `designs-README.md` 的索引模板。
- **引擎二进制**（`.gdmcp/`、Godot exe）：可再生工具链，新机自行安装。
