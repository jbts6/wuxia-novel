# generate-kb 经验教训

天龙八部 pilot 的实测经验，供后续项目参考。

## 章节事件错位是最大风险

LLM 一次性生成 50 章的 chapter_summaries 时，最容易出现**事件与章节号错位**——记得事件本身，但记错了发生在哪一章。

**天龙八部 pilot 错位示例**：
| 章节 | LLM 标注 | 实际内容 |
|------|----------|----------|
| ch17 | 聚贤庄英雄宴 | 段誉王语嫣逃离西夏 |
| ch18 | 聚贤庄血战 | 乔峰养父母被害、玄苦圆寂 |
| ch19 | 乔峰阿朱感情发展 | **聚贤庄血战** |
| ch20 | 雁门关伏击真相 | 乔峰身世大白（基本正确） |

**后果**：Phase 2.5 按错误事件提取对话，ch18 提取了 6 条对话但全部验证失败（0% 真实率）。

**解决**：Phase 2.2 交叉验证 + 错误章节修正后重跑。

## prompt 质量直接影响后续阶段

专属 prompt 中的章节号错误会级联影响：
- outline.json 的实体分布
- Pass 1 的 source_refs 锚定
- chapter_summaries 的事件分配
- dialogues 的提取成功率

**Phase 1.6.5 的 prompt 校验是必要的防御步骤。**

## dialogues 提取方案演进

1. **旧方案（正则提取）**：每章抓 100+ 条对话，大量噪音，说话者识别不准
2. **LLM 凭记忆生成**：75% 真实率，但对虚竹线等段落记忆偏差大
3. **当前方案（LLM 读原文 + 事件锚定）**：66-73% 真实率，232 条对话覆盖 47/50 章

关键改进：让 LLM 先读原文再挑选对话，而不是凭记忆生成。

## items.owner 必须支持 faction ID

cross-validate.js 的 ID 引用完整性检查中，`items.owner` 不仅可以是 `characters.json` 中的角色 ID，还可以是 `factions.json` 中的门派 ID（如物品属于某个门派）。

**已修复**：`cross-validate.js` 第 155 行增加 `!factionIds.has(i.owner)` 检查。

## verify_dialogues.js 已参数化

原脚本硬编码了天龙八部目录路径，现已改为接受命令行参数：
```bash
node verify_dialogues.js <dialogues_json_file> [novelDir]
```
