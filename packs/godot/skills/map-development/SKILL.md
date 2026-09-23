---
name: map-development
description: >
  新增地图/城市的标准流程与规范（Godot 地图层）的索引入口。覆盖坐标系统一（GCJ02 墨卡托与
  mercator.gd 投影）、高德瓦片下载与底图拼接（4096 纹理上限）、map_config.json 各视图段
  （map_view/province_map_view/city_zoom_view/unified_views/region_map_views）、
  L0-L3 缩放拖动交互层级与信号、region/POI 多语言键规范、地图工具链与历史坑。
  当任务涉及新增城市/省份/区域地图、下载或替换底图瓦片、调地图缩放拖动交互、
  改 map_config.json 或 regions.json、加地图 POI/区名、地图坐标偏移或纹理超限问题时使用。
---

# 地图开发（索引入口）

**正文唯一事实源 → `docs/地图开发标准模板.md`**

⚠️ 本技能**只做触发 + 索引**，禁止在此复制正文（2026-09-11 去重：此前正文抄两份，
37 天漂移风险 + 无 frontmatter 导致技能不可发现）。改规范**只改 docs 那一份**。

## 动作（强制顺序）

1. 动手前**完整读** `docs/地图开发标准模板.md`（96 行，别只读本文件就开干）
2. 按对应章节执行 → 收尾跑 §7 工具链验证 + §8 常见坑自查

## 章节索引

| § | 内容 | 何时翻 |
|---|------|--------|
| 1 | 坐标系与数据流（GCJ02 墨卡托唯一标准） | 坐标偏移/新增底图来源 |
| 2 | 配置结构 `data/map_config.json` | 加视图段/调 zoom/tile_origin |
| 3 | 新增城市/地图 6 步 | 新增城市、省份、区域 |
| 4 | 交互层级模板 L0-L3（上海已验证） | 缩放/拖动/层级/未开放区提示 |
| 5 | 语言规范（硬性） | 加 POI/区名/APP 图标/类别名 |
| 6 | 命名与规范 | 底图文件命名、配置段命名 |
| 7 | 工具链（3 个 python 脚本） | 下瓦片、拼图、GeoJSON→regions |
| 8 | 常见坑（历史事故） | 收尾自查 |

## 三条硬约束（速查；与 docs 冲突一律以 docs 为准）

1. 坐标全 **GCJ02 墨卡托**，投影只用 `features/map/mercator.gd`，**禁手写公式**
2. 底图单边 **≤4096**（移动端纹理上限；超限降 z 或降采样）
3. 用户可见文本**全走** `_t()`（`app_text_config.json` 的 map 段 zh/en）或 `_region_display_name()`/`name_en` 数据，**禁硬编码中文**

## 关键文件

| 文件 | 角色 |
|---|---|
| `data/map_config.json` | 地图配置（各视图段，按 adcode 索引） |
| `data/regions.json` | 区域边界（经纬度版，`tools/geojson_to_region.py` 产出） |
| `features/map/mercator.gd` | 唯一投影实现 |
| `ui/phone/app_views/app_map_view.gd` | 层级路由状态机 |
| `tests/unit/test_gut_map_zoom.gd` | 数据契约 + 交互断言 |
