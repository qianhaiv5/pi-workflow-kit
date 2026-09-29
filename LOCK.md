# kit 写权锁（层 1 · 2026-09-28 拍板）

> **采纳记录**（KIT-GOVERNANCE §4 格式）
> - **来源**：对方 agent 本地提交 `af0ff0a`（2026-09-28 20:42，**未推**，跨机不可见）· 原文经协调人转贴，**内容按本节逐字采纳**
> - **评估人**：AmberFalcon（orchestrator · 项目 `D:/MyGame_journey`）· **日期**：2026-09-29
> - **依据**：① 含「层 1 · 2026-09-28 拍板」的历史出处 ② 五条纪律覆盖了本批实测到的全部风险（未推提交撞车 / 非快进被拒 / 反向覆盖）③ 我方 `tools/kit-lock.mjs` 当时**只跑了 `status`**，纪律面弱于本文
> - **合并处置**：本文为**纪律基线**；`tools/kit-lock.mjs` 为**代码基线**（我方 A0：`--who/--why/--project/--ttl/--force` 形态 + TTL 陈旧判定 + 实测三连负控）。⇒ 原文的 `acquire <项目名>` / `--ttl-min` 接口**作废**，纪律条已按代码基线改写（见 §纪律 1）。

**背景**：`~/.pi/agent/kit`（`pi-workflow-kit.git`）是**多个项目共用**的唯一工作副本（全局仓 `.gitignore` 已忽略 `kit/`；本仓为**嵌套克隆**）。
多项目同时改 kit ⇒ 工作树互踩 / 非快进被拒 / `extract-kit.mjs` 反向覆盖。

## 纪律

1. **改 kit 前必须持锁**：
   ```bash
   node tools/kit-lock.mjs acquire --who <你的 agent 名> --why "<本批事项>" [--project <项目根>] [--ttl 30]
   ```
   （默认 TTL **30 min**；超期锁视为**陈旧**，可被他人 acquire 覆盖 —— 防止一方掉线永久锁死）
2. **未持锁只能读**：`git -C ~/.pi/agent/kit pull --ff-only`；**禁** commit / 编辑 / `extract-kit`
3. **推送前**必 `pull --ff-only`；冲突 ⇒ **停手报 Coordinator**，禁强推
4. **收工必 `release`**（`node tools/kit-lock.mjs release --who <同名>`；或等 TTL 过期）
5. **抢锁（`--force`）仅在确认对方停工后使用，且必须登记**（登记处 = 本批的 commit message 或 `KIT-GOVERNANCE.md` §4 采纳记录）

## 状态查询

```bash
node tools/kit-lock.mjs status        # 打印：无锁 / 有效锁（含 holder/host/project/why/age/ttl） / ⚠ 陈旧锁
```
退出码：`status` 恒 0；`acquire` 被已有有效锁拒绝 ⇒ **2**；`release` 非持锁者且无 `--force` ⇒ **2**。

## ⚠️ 撞车判据（2026-09-29 立 · 反例 D）

「远端没有该文件」**不构成**撞车结论 —— 必须先排除「查错分支」与「网络不可达」：

```bash
git ls-remote --symref origin HEAD | head -1        # 自证分支名（本仓 = refs/heads/main；**无 master**）
git ls-remote origin refs/heads/main >/dev/null 2>&1 || echo "未复核：网络不可达（禁下结论）"
git ls-remote origin refs/heads/main | grep -q 'tools/kit-lock.mjs' || echo "远端确实无该文件"
git log --oneline -- tools/kit-lock.mjs | wc -l     # 本地非空 ⇒ 我方有此实现
```
**判据三态**：① **撞车**（远端无 ∧ 本地有 ∧ ls-remote 成功）② **未复核**（ls-remote 失败）⇒ **停手**，不得下结论 ③ **正常**（远端有）。
