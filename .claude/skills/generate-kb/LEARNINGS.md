# generate-kb 经验教训

按主题压缩；细节以 `pipeline.md` / `assess-quality.js` 为准。

## 1. 章节事件错位

LLM 批生成 chapter_summaries 易**记错章号**。后果：对话按错章抽取 → 真实率崩。  
**防**：Phase 2.2 交叉验证；1.6.5 校验专属 prompt 里的章节/事件。

## 2. dialogues 必须原文

| 做法 | 结果 |
|------|------|
| 凭记忆编 quote | 幻觉多 |
| 正则狂抽 | 噪音大、说话者错 |
| **读 ch_split + 事件锚定**，字段 **`text`** | 可 verify / locate-dialogues |

`locate-dialogues` 认 `text`（兼容 `quote`）。勿整表复制进 baseline.dialogues。

## 3. 独立 baseline vs 假满分

| 错误 | 后果 |
|------|------|
| 从 data 拷角色表且无 rel/events | `invalid_self_ref`，金标 N/A |
| 为 Cross-Book Purity 把 KB 全量写入 baseline | 假 100 purity / 自指警告 |
| importance 写「核心/主线」不写英文 | 关系/事件 expected=0 → 金标 N/A |

**正确**：短金标（约 15–25 人）+ rel/events/原文 quotes；`bl/kb` id 覆盖约 50%–84%；Purity 允许因「KB 多出的实名龙套」&lt;100。

## 4. 名称匹配陷阱

短 item 名（剑、蝎）曾被子串匹配当成「覆盖」任意含该字角色。  
**现**：`namesMatch` 忽略 1–2 字泛称且要求子串侧 ≥3 字。  
物品尽量用具名（飞刀、龙凤环），勿单字凑数。

## 5. 关系与分类

- 关系只写单向时必跑 `fix-relationships.js`  
- skills = 武学体系；兵器/暗器实物 → items  
- `items.owner` 可为 char 或 faction id  

## 6. 长书 Entity Quantity

章数≥50 时 skills/locations 门槛高。古龙具名武学少时：  
- 只收录**原文出现**的功法/门派名  
- 禁止跨书门派硬凑  
- 可用「剑法/轻功」等原文高频类名，但勿灌无来源专名  

## 7. 其他

- `verify_dialogues.js`：`node verify_dialogues.js <dialogues.json> [novelDir]`  
- prompt 章节错会级联全程 → 1.6.5 不可省  
- 完成以 **completion_gate + honest** 为准，不以自指金标满分宣称完工  
