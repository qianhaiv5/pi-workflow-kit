---
name: godot-docs
description: >
  查询本地 Godot 4.7 官方文档（1593 个 .md 文件，含教程、类参考、最佳实践）。
  当 MCP get_class_api_metadata 不够用（需要方法描述、使用示例、教程）时使用。
  文档路径：{{GODOT_DOCS_DIR}}/Godot Engine 4.7 documentation in English MD/
disable-model-invocation: true
---

# Godot 4.7 本地文档查询

本地有完整 Godot 4.7 官方文档的 Markdown 版本（1593 个文件，16MB）。
文档路径：`{{GODOT_DOCS_DIR}}/Godot Engine 4.7 documentation in English MD/`

## MCP vs 文档：什么时候用什么

| 需求 | 用 MCP | 用文档 |
|------|--------|--------|
| 类的属性/方法/信号列表 | ✅ `get_class_api_metadata` | 也可，但 MCP 更快 |
| 方法签名和参数类型 | ✅ `get_class_api_metadata` | 也可 |
| 方法的详细描述和使用场景 | ❌ MCP 不给描述 | ✅ 查文档 |
| 代码示例 | ❌ | ✅ 查文档 |
| 教程（2D/3D 入门、最佳实践） | ❌ | ✅ 查文档 |
| @GDScript 内置函数（print, load, preload...） | ❌ | ✅ gdd_1590 |
| @GlobalScope 全局常量/函数 | ❌ | ✅ gdd_1591 |
| 类之间的关系、继承树 | 部分 | ✅ gdd_0511 + 具体类 |
| 编辑器开发、插件制作 | ❌ | ✅ 查文档 |

## 文档结构

```
README.md           — 完整章节索引（按编号列出所有 1592 个文件）
gdd_0001~gdd_0231   — 入门教程、编辑器介绍、最佳实践
gdd_0232~gdd_0510   — 专题指南（2D/3D/动画/音频/网络/着色器/UI...）
gdd_0511            — All_classes.md（所有类的分类索引）
gdd_0512~gdd_1587   — 类参考（每个 Godot 类一个文件）
gdd_1588~gdd_1592   — 索引、404、@GDScript、@GlobalScope
```

## 搜索方法

### 方法 1：找特定类的文档

类名转文件名规则：空格 → 空，特殊字符保留，大小写敏感。

```bash
# 精确查找（推荐）
ls "{{GODOT_DOCS_DIR}}/Godot Engine 4.7 documentation in English MD/" | grep -i "gdd_.*_Node\.md$"
ls "{{GODOT_DOCS_DIR}}/Godot Engine 4.7 documentation in English MD/" | grep -i "gdd_.*_CharacterBody2D\.md$"
ls "{{GODOT_DOCS_DIR}}/Godot Engine 4.7 documentation in English MD/" | grep -i "gdd_.*_@GDScript\.md$"
```

### 方法 2：全文搜索关键词

```bash
# 在所有文档中搜索概念/函数名
grep -l "关键词" "{{GODOT_DOCS_DIR}}/Godot Engine 4.7 documentation in English MD/"gdd_*.md

# 只在类参考中搜索
grep -l "关键词" "{{GODOT_DOCS_DIR}}/Godot Engine 4.7 documentation in English MD/"gdd_05[0-9][0-9]_*.md "{{GODOT_DOCS_DIR}}/Godot Engine 4.7 documentation in English MD/"gdd_1[0-5][0-9][0-9]_*.md
```

### 方法 3：读 README 索引找章节

```bash
# 找某个主题在哪个文件
grep -i "topic" "{{GODOT_DOCS_DIR}}/Godot Engine 4.7 documentation in English MD/README.md"
```

## 常用文件速查

| 内容 | 文件 |
|------|------|
| 所有类索引 | `gdd_0511_All_classes.md` |
| Node 基类 | `gdd_0512_Node.md` |
| @GDScript 内置函数 | `gdd_1590_@GDScript.md` |
| @GlobalScope 全局 | `gdd_1591_@GlobalScope.md` |
| 最佳实践总览 | `gdd_0042_Best_practices.md` |
| 场景组织 | `gdd_0045_Scene_organization.md` |
| 信号使用 | `gdd_0022_Using_signals.md` |
| 导出项目 | 搜索 `grep -l "Export" README.md` |
| GDScript 基础 | `gdd_0019_Scripting_languages.md` |

## 读取文档时的注意事项

1. **文件可能很长**（Node.md 近 2000 行），用 `head -100` 先看结构
2. 每个类文档的结构：Description → Tutorials → Properties → Methods → Signals → Enumerations → Constants
3. 描述部分（Description）最有价值 — MCP 不给这部分
4. 代码示例通常在方法描述的段落中
5. 文档是英文的，类名和方法名保持原样

---

## 上游实战增补（2026-09-26 回灌 · 每条都带判据）
### 新素材落地三查
- ① **位置**（按惯例目录）② **命名**（英文 + 帧号两位）③ **`.import` 已生成**
  （`godot --headless --import`，否则运行时 `No loader found`）。
- 素材契约要**明示格式**（如「只收 `.webp`」），否则会在压缩/替换批里反复踩。
