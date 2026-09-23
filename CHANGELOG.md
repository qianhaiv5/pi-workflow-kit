# CHANGELOG

## 2026-09-24 · 修两起上游反馈缺陷（用户实机踩到）

### fix(apply-kit): 缺 `--target` 不再回退 cwd + 加 `--help` + 目标守卫
- **现象**：无 `--help`；不给 `--target` 时默认写 cwd ⇒ 在 `~/.pi/agent` 里误跑，**污染 pi 全局配置**。
- **处置**：`--target` 必填（缺即 `exit 2` 且不落盘）；未知/错拼参数 `exit 2` + 打印用法；新增 `--help`；新增目标守卫（`~/.pi/agent` / 含 `settings.json`+`npm/node_modules` / kit 自身所在树 ⇒ 拒写 `exit 2`）。
- **回归**：`tools/kit-teeth.mjs` TC01–TC11。

### fix(packs/godot): `.mcp.json` 的 `GODOT_PATH` 不再硬编码源机布局
- **现象**：模板写成 `<GODOT_DOCS_DIR>/Godot_v4.7.1-stable_mono_win64/Godot_v4.7.1-stable_mono_win64.exe`（extract 只把 `D:/Godot4.7` 换成占位符，把安装子目录/版本号留在模板里）⇒ 换机必产出**不存在的路径**。
- **处置**：`extract-kit.mjs` 新增 `RULES` 正则改写，把整个值抹成单一 `{{GODOT_PATH}}`；`apply-kit` 缺 `--godot-path`/`--godot-docs` 时落 `TODO-...` 并警告，且**不再猜测**文档目录。
- **顺带**：`extract-kit.mjs` 新增通用守卫 —— 生成物里出现白名单（`D:/tmp` 约定）之外的机器绝对路径即**硬报错**（这类 bug 的通用闻探；当初若有此守卫，缺陷②在生成时就会被拦下）。
- **回归**：`tools/kit-teeth.mjs` TC12–TC19、TC27–TC29。

### test: 新增 `tools/kit-teeth.mjs`（32/32）
用法/守卫/GODOT_PATH 参数化（断值不断非空）/无机器路径与源机字面量残留/占位符与 pack 标记清理/`extract-kit --check` 同步。
