---
name: distill-items
description: Use when a wuxia novel directory needs its items.json cleaned and normalized, when the user asks to clean up item types or fix item data quality, or when distilling items for all books.
---

# 提炼道具

从 `<小说目录>/items.json` 提炼出干净的道具数据。按游戏设计思维筛选：只保留有名字、有故事、有特殊属性的道具。

## 核心原则

**像编纂道具图鉴一样筛选。** 只有有名号、有故事、有特殊属性的道具才配列入图鉴。值得保留的只有三类：

1. **兵器/装备** — 有名号的武器、护甲（玄铁重剑、软猬甲），普通单刀长剑不要
2. **药品** — 疗伤药、毒药、解药（九花玉露丸、情花毒、断肠草）
3. **特殊道具** — 功法秘籍、有剧情意义的信物、蛇胆等奇物

其余全部删除：场景物、临时凑合、普通容器、日常用品、无特殊属性的饰品。

## 标准类型（11 类）

| 类型 | 说明 | 保留标准 |
|------|------|----------|
| 兵器 | 有名号的武器 | 只留有专属名号或特殊属性的，普通刀剑枪棒删除 |
| 暗器 | 有名号的暗器 | 冰魄银针、玉蜂针等，普通飞镖删除 |
| 防具 | 护甲、护具 | 软猬甲、金丝手套等，普通衣物删除 |
| 丹药 | 疗伤药、解药 | 九花玉露丸、断肠草等，普通金创药删除 |
| 毒药 | 毒物、毒虫 | 情花、彩雪蛛等，普通毒粉删除 |
| 信物 | 有剧情作用的持有物 | 锦帕、书信、地图等，普通首饰删除 |
| 秘籍 | 武功秘笈、经书 | 九阴真经、葵花宝典等 |
| 坐骑 | 有名号的坐骑 | 汗血宝马、双雕等，普通马匹删除 |
| 食物 | 有剧情作用的食物 | 蛇胆、寒潭白鱼等，普通饭菜删除 |
| 工具 | 有剧情作用的器具 | 号角、阵具等，普通绳索删除 |
| 饰品 | 有特殊属性的饰品 | 极少保留 |

## TYPE_MAP（非"特殊"类型自动映射）

```
兵器/weapon/随身利器/siege_weapon/武器 → 兵器
暗器/hidden_weapon/兵器暗器 → 暗器
丹药/pill/medicine/药瓶/解药/金创药/香药/毒草兼解药 → 丹药
毒药/poison/毒物 → 毒药
防具/armor/clothing/衣饰/服饰/衣物 → 防具
食物/酒 → 食物
坐骑/mount/灵禽 → 坐骑
信物/书信/信件/令牌/message/token/证物/图卷/书画/军旗 → 信物
秘籍/武学秘笈/武学图谱/经书/书籍/book/manual/document → 秘籍
工具/tool/training_tool/临时工具/随身器物/随身物/器物/物品/formation/trap → 工具
饰品/饰物/accessory/首饰/剑饰/jewelry → 饰品
```

未映射的类型 → 删除。

## 执行

### Phase 0：预清洗

1. 运行共享预清洗器：
   ```bash
   node scripts/preclean/sanitizer.js <小说目录> items.json items --companions '{"characters":"<小说目录>/characters.json"}'
   ```
2. 检查 `archive/reports/items.sanitize-report.md`，确认自动修复合理
3. 检查 `archive/reports/items.pending.json`，记录待复核项（`type_not_in_map` 的条目需人工判断）

预清洗自动完成：字符串清理、type 枚举归一（含英文→中文映射）、`rarity_tier: "未知"` → `寻常凡品`、owner 引用修复、同 type+同 name 精确去重、空值规整。`archive/raw/items.json` 保留原始快照。

### Phase 1：人工清洗

1. 读取已预清洗的 `<小说目录>/items.json`（已被 Phase 0 改写）
2. **非"特殊"类型**：检查 TYPE_MAP 映射结果，处理 Phase 0 标记的 pending 项
3. **评分"特殊"类型**：

| 信号 | 分值 |
|------|------|
| `source_refs` ≥ 3 | +2 |
| `source_refs` ≥ 5 | +2 |
| 名字出现在 `chapter_summaries` | +3 |
| 有 `owner` | +1 |

- score ≥ 3：自动保留
- score = 0：自动删除
- score 1–2：待定，输出列表供人工判断

4. **人工复核待定项**：输出 `items_pending.md`，用户决定保留/删除
5. **去人名**：兵器/防具/饰品/暗器/坐骑去掉人名前缀，同类型同名合并
6. **道具图鉴过滤**：再过一遍保留清单——这个道具是否有资格列入图鉴？有名号、有故事、有特殊属性的才留，普通货色删
7. 写入 `<小说目录>/items.json` + `<小说目录>/items_summary.md`

## 品阶

| 品阶 | 说明 |
|------|------|
| 绝世神兵 | 天下仅此一件 |
| 稀世珍品 | 罕见珍品 |
| 上乘佳品 | 精良之物 |
| 寻常凡品 | 普通物品（"未知"的默认值） |

## items_summary.md 格式

```markdown
# 《书名》道具清单

共 N 件（原 M 件，保留 X%）

## 按类型统计
| 类型 | 数量 |
|------|------|
| 兵器 | 16 |
| ... | ... |

## 保留清单
| 道具 | 类型 | 品阶 |
|------|------|------|
| 玄铁重剑 | 兵器 | 绝世神兵 |
| ... | ... | ... |
```

## 产物校验

- JSON 可解析
- 无重复 ID
- `type` 只有 11 种标准值
- `rarity_tier` 只有 4 种标准值（无"未知"）
- `source_refs` 和 `rag_refs` 原样保留
- 保留率通常 15%–30%（神雕侠侣 278→63，23%）
