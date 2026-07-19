# V6 知识库审计、迁移与归档设计

## 1. 目标与边界

本任务以 semantic contract V6 为唯一活动数据标准。系统先审计所有书籍目录，保持已经合格的 V6 数据字节不变；对旧 JSON 数据优先执行确定性迁移；只有不可迁移或迁移失败的数据才归档。迁移不得重新运行章节提取、领域提取，也不得让模型重新阅读小说或补造证据。

最终活动 `<author>/<book>/data` 只允许包含五个 V6 YAML：

- `characters.yaml`
- `skills.yaml`
- `items.yaml`
- `factions.yaml`
- `chapter_summaries.yaml`

活动数据还必须拥有与 run、源文件、final 文件哈希绑定的安装收据，并通过现有 canonical installed verifier。

## 2. 已确认的仓库事实

- 仓库发现 87 个书籍目录，其中 18 个存在活动 `data`。
- `古龙/剑神一笑` 是当前唯一通过 canonical V6 installed verification 的书籍。
- 其余 17 本活动数据均为旧 JSON。14 本缺少安装收据；`金庸/笑傲江湖`、`金庸/雪山飞狐`、`金庸/飞狐外传` 带旧 semantic contract V2 收据。
- 大多数旧实体保留 `source_refs`；少量人物或物品没有可验证证据。
- `金庸/书剑恩仇录` 的活动 `data` 不完整，但保留运行目录中存在完整旧 final。
- V6 代码已经提供 `js-yaml`、五文件 final verifier、安装收据校验、`archiveExisting()` 原子归档与移动失败回滚。

## 3. 方案比较

### 3.1 采用：隔离候选、验证、归档、安装、复验

先在书籍目录之外构建完整候选，调用 canonical verifier；候选合格后才归档旧生成物、安装候选并复验。该方案最大限度降低活动数据变更风险，并避免归档逻辑误移走新候选。

### 3.2 未采用：先归档再构建候选

实现较简单，但候选生成期间书籍没有活动数据；若迁移器存在缺陷，所有书都会更早进入不可用状态。

### 3.3 未采用：在活动目录原地改写 JSON

代码量最少，但无法清晰证明候选与旧数据的边界，容易留下混合文件集，也不符合完整备份和失败审计要求。

## 4. 组件边界

### 4.1 Repository auditor

只读扫描仓库的 `<author>/<book>` 目录，识别活动 `data`，调用 `verifyInstalled()`，并输出：

- 当前合格；
- 旧数据、可进入迁移预检；
- 损坏或无法识别；
- 非知识库目录。

审计默认只读，不因为发现错误而移动文件。输出同时提供 JSON 机器报告和 Markdown 人类报告。

### 4.2 Legacy source resolver

每本书只选取一个权威旧数据源，不把多个旧 final 混合拼接。优先级为：

1. 活动 `data` 中类别齐全且可解析的旧 final；
2. 与当前小说/章节清单可绑定的最新完整 retained run final；
3. 与当前小说/章节清单可绑定的最新完整 archive final。

若高优先级来源不完整，可回退到下一来源；回退原因、候选路径和哈希写入迁移收据。时间戳只用于在均满足完整性与来源绑定时排序，不能替代验证。

### 4.3 Deterministic mapper

纯函数式转换旧记录，不读小说来补充内容，不调用模型。输出 V6 record model、拒绝记录和 unresolved reference 三类结果。

| V6 类别 | 确定性映射 |
|---|---|
| 人物 | `alias/aliases -> aliases[]`；`identity -> identities[]`；合法 `importance -> level`；已有简介、生平和性格文本按固定顺序去重拼接为 `description` |
| 武功 | `alias -> aliases[]`；`type -> types[]`；已有招式规范化为 `techniques[]`；说明、效果等已有文本按固定顺序组成 `description` |
| 物品 | 别名和说明直接规范化；旧类型通过版本化固定映射表进入 `武器/防具/秘籍/丹药/暗器/其他`，不能明确映射时为 `null` |
| 门派 | 保留名称、别名、类型与已有说明；不迁移成员列表 |
| 章节摘要 | 保留 `chapter/title/summary`，按章节号绑定当前章节清单和章节哈希 |

禁止写入 V6 已移除的 `holders`、`owner`、`members`、人物 `items` 等关系。

旧 `power_rank`、`mastery_rank` 即使取值出现在 V6 rank scale 中，也不能证明遵守“全书完整时间线的稳定判断”。除非旧工件带有可验证的 V6 等价全书语义来源，否则人物和武功一律迁移为 `rank: null`。

### 4.4 Evidence rebuilder

只复用旧 `source_refs`、旧章节摘要、当前章节清单及其哈希：

- 实体至少需要一条能绑定现有章节且能验证文本/行号/锚点的证据；
- 无证据或证据全部失效的实体被拒绝，不由模型修复；
- 缺少 `source_refs` 的章节摘要可以按章节号绑定当前章节哈希，但必须覆盖完整章节清单；
- 每条保留、拒绝和无法解析的证据都进入迁移收据；
- 重建后的 accepted chapter evidence、domain decisions 和 ID plan 必须满足现有 workspace verifier，而不是绕过它。

### 4.5 ID planner 与引用解析

- 已满足 V6 类别前缀且无冲突的旧 ID 可以保留；
- 其他 ID 由类别、规范化名称、旧 ID 和证据指纹确定性生成；
- 同名实体不自动合并；
- 拼音相同或基础 ID 冲突时追加稳定短指纹；
- 人物 `factions[]/skills[]` 和武功 `factions[]` 只保留能解析到本次候选实体的引用；
- unresolved reference 不创建虚构实体，逐条写入报告。

### 4.6 Candidate workspace writer

候选写到显式 staging root，例如：

`<repo>/.game-kb-migration-staging/<author>/<book>/<run-id>`

该目录位于书籍目录之外，但与仓库处于同一卷，避免被 `archiveExisting()` 当成旧生成物移动，并允许安全 rename。候选包含完整 V6 run 所需工件：accepted evidence、domain decisions、ID plan、五个 YAML、verification report 和 migration receipt。

迁移代码必须调用现有 canonical verifier；不能复制一套较弱的“迁移专用验证器”。

### 4.7 Transaction controller

单本书的事务顺序：

1. 完成只读预检并选择旧来源；
2. 在隔离目录构建候选；
3. canonical workspace verification 通过；
4. 调用 `archiveExisting()` 原子归档旧生成物；
5. 将已验证 run 移入新的 `.game-kb-work/runs/<run-id>`；
6. 调用现有 installer 安装五个 YAML 和安装收据；
7. 调用 `verifyInstalled()` 复验；
8. 写入最终迁移状态并清理成功 staging。

候选构建失败时，旧生成物仍按“不合格数据”归档。归档之后发生安装或复验失败时，清理/隔离部分 V6 数据，旧 JSON 继续保留在 `_archive`，不得恢复为活动 `data`。单本失败不阻断其他书籍。

### 4.8 Receipt 与报告

通用 `migration-receipt.json` 至少记录：

- operation、schema version、semantic contract version、run ID；
- author/book、旧来源路径与逐文件哈希；
- 当前小说、章节清单与章节哈希；
- 每类输入、输出、拒绝数量；
- 每条拒绝记录和 unresolved reference 的稳定标识与原因；
- ID 映射；
- 五个 YAML、ID plan、verification report 的哈希；
- archive manifest 路径与哈希；
- 事务阶段、成功/失败状态和可重试命令。

安装收据继续使用通用 `migration_receipt_hash` 字段。实现新增通用 receipt 文件，同时对既有 `chapter-import-receipt.json` 保持只读兼容。

仓库级最终报告必须列出：原本合格、迁移成功、不可迁移并归档、迁移失败并归档，以及每本书的原因和归档位置。

## 5. CLI 与使用示例

仓库审计命令默认只读：

```powershell
node .agents/skills/generate-game-kb/scripts/audit-v6.js "C:\git\wuxia-novel" --output ".trellis\tasks\07-19-audit-v6-knowledge-bases\reports"
```

单本预检不需要确认：

```powershell
node .agents/skills/generate-game-kb/scripts/flow.js migrate-legacy "C:\git\wuxia-novel\金庸\书剑恩仇录" --run "migrate-shu-jian-v6-20260719" --from "C:\git\wuxia-novel\金庸\书剑恩仇录\.game-kb-work\runs\run-2026-07-16T10-46-26-386Z-32728-9ddeb760\final\data"
```

发生文件移动和安装时必须显式确认，并使用相同参数：

```powershell
node .agents/skills/generate-game-kb/scripts/flow.js migrate-legacy "C:\git\wuxia-novel\金庸\书剑恩仇录" --run "migrate-shu-jian-v6-20260719" --from "C:\git\wuxia-novel\金庸\书剑恩仇录\.game-kb-work\runs\run-2026-07-16T10-46-26-386Z-32728-9ddeb760\final\data" --confirm
```

这些真实示例同步写入 `SKILL.md`、`SKILL-cn.md`、`examples.md` 和 `examples-cn.md`。CLI 必须正确处理中文作者和书籍目录。

## 6. 迁移资格与失败条件

一本书只有同时满足以下条件才可安装迁移结果：

- 旧权威来源可解析，且所需类别可形成五个 V6 文件；类别可以为空，但文件不能缺失；
- 章节摘要完整覆盖当前章节清单，章节号唯一且可绑定；
- 所有被保留实体具有有效证据；无效实体已经进入拒绝清单；
- ID 唯一、引用可解析或已按规则拒绝；
- 候选 workspace verification 通过；
- 安装后 canonical installed verification 通过。

损坏 JSON、章节摘要缺失/重复/越界、无法建立章节绑定、归档碰撞或 canonical verifier 失败，都使本次迁移失败并进入归档结果。

## 7. 测试设计

### 7.1 单元测试

- 各旧字段变体到 V6 的映射；
- 文本合并顺序、去重与空值；
- rank 归零、level 合法值映射；
- 物品类型固定映射；
- 禁止关系字段清除；
- 中文同名、同拼音和旧 ID 冲突；
- source ref 各旧形态的验证与拒绝。

### 7.2 资格与来源测试

- 活动数据完整时优先选择；
- 活动数据不完整、retained final 完整时回退；
- 多个旧 run 仅选择一个权威来源；
- 缺章节摘要、损坏 JSON、失效证据时给出稳定错误码；
- 无证据实体被剔除但其他有效实体仍可迁移。

### 7.3 事务测试

在候选写入、归档移动、run 移入、安装 rename 和 installed verification 后分别注入故障，断言：

- 归档前失败不产生部分活动 V6；
- 已判定不合格的旧数据最终进入 `_archive`；
- 归档后失败不会恢复旧 JSON 为活动 `data`；
- manifest、receipt 和 staging 状态足以手动重试；
- 单本失败不影响其他书。

### 7.4 集成验证

- 使用中文作者/书名 fixture 在 Windows 路径上完成旧 JSON -> V6 YAML -> install -> verify 全流程；
- 运行 generate-game-kb 全测试集；
- 先对真实 18 本活动知识库 dry-run；
- 实际迁移逐本执行，最终对所有剩余活动 `data` 运行 canonical installed verification；
- 断言 `古龙/剑神一笑` 字节不变。

## 8. Git 阶段提交

1. 规划与设计；
2. 迁移器、CLI、测试和命令示例；
3. 全仓 dry-run 审计报告；
4. 实际迁移与归档结果；
5. 最终验证报告、规格更新和任务归档。

每本书使用独立事务和 receipt；Git 按上述阶段提交。现有未跟踪 `.claude/skills/*`、`docs/wuxia-kb-build-priority.md` 和用户修改的小说文本不进入本任务提交。

## 9. 非目标

- 重新提取小说章节或重新运行领域蒸馏；
- 让模型修补、丰富或推断旧记录；
- 为缺失实体制造证据；
- 恢复 V6 已禁止的持有者、成员、人物物品等关系；
- 修改已合格《剑神一笑》的活动数据。
