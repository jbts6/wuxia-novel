# 预清洗共享框架

通用预清洗器，供各 distill skill 调用。处理字符串清理、去重、空值规整等通用逻辑，类型专属逻辑从各 skill 目录的 `preclean-config.js` 加载。

## 用法

```bash
node <本目录>/sanitizer.js <小说目录> <文件名> <文件类型> [--companions JSON]
node <本目录>/run.js <小说目录>           # 批量预清洗全部文件
```

## 文件类型

| fileKind | 配置来源 |
|----------|----------|
| characters | `distill-characters/preclean-config.js` |
| dialogues | `distill-dialogues-locations-factions/preclean-config.js` |
| locations | `distill-dialogues-locations-factions/preclean-config.js` |
| factions | `distill-dialogues-locations-factions/preclean-config.js` |
| items | `distill-items/preclean-config.js` |
| skills | `distill-skills-and-techniques/preclean-config.js` |
| techniques | `distill-skills-and-techniques/preclean-config.js` |

## 扩展

新增维度只需：
1. 在对应 skill 目录创建 `preclean-config.js`
2. 在 `sanitizer.js` 的 `kindToSkill` 映射中注册
