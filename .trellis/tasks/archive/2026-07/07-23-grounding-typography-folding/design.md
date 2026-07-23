# 严格排版符号 grounding 设计

## 核心决策

原文不变，Worker 规则不变，容错只发生在 Controller 的确定性匹配层。流程为：

```text
Worker quote
   │
   ├─ exact match 成功 ──> 现有行为，无审计
   │
   └─ exact match 失败
          │
          └─ allowlist 一对一 folding
                  │
                  ├─ 唯一命中 ──> 回填源文本 + grounding audit
                  └─ 零/多命中 ──> SOURCE_QUOTE_NOT_FOUND
```

## 匹配模型

### Canonical source index

保留 `grounding.js` 现有 BOM、CRLF、NFKC 和空白折叠。`normalizedChapterIndex()` 在现有 `normalized` 与 `lineByOffset` 之外生成一个仅用于比较的 typography view。

allowlist 映射全部保持单个 UTF-16 code unit 到单个 code unit：

| 输入 | 比较字符 |
|---|---|
| `。`、`.` | `.` |
| `“`、`”`、`「`、`」`、`『`、`』`、`"` | `"` |
| `‘`、`’`、`'` | `'` |

由于长度保持一致，folded view 的命中 offset 可以安全映射回 `normalized`、`lineByOffset` 和源章节 canonical text。不得加入一对多或多对一映射。

### 两阶段解析

新增或抽取一个由验证与 accepted projection 共用的 quote resolver：

1. 对 normalized quote 做 exact search；命中即返回现有结果，不要求唯一，也不记录 typography audit。
2. exact 失败时，对 source view 和 quote 执行 allowlist folding。
3. 枚举 folded quote 的全部命中 offset；只有一个命中时成功。
4. 用相同 offset 从未做 typography folding 的 `chapterIndex.normalized` 切出 canonical source quote。
5. 使用现有 `lineByOffset` 派生 `line_start` / `line_end`。
6. 零命中或多命中返回未命中，不引入新错误码。

若调用方提供已验证行范围，fallback 只在该范围内判断唯一性，不能越过行范围寻找替代文本。

## Accepted projection 与审计

`accepted-chapter.js` 调用同一个 resolver，不重复实现匹配。fallback 成功时：

- `source_refs[].text` 写入 canonical source quote；
- `chapter.normalizations` 追加：
  - `field_path`
  - `original_value`
  - `normalized_value`
  - `normalization_rule: grounding.typography-fold.v1`

normalization 的顺序按实体遍历和 source ref 索引保持稳定。

`book-assembly.js` 保留现有 `deterministic_audit.type_normalizations`，只让类型规则进入该数组；新增 `grounding_normalizations` 接收 `grounding.` 前缀规则，避免审计语义混淆。

## 失败边界

- `、` 与 `,` 不等价。
- `—` 与 `-` / `--` 不等价。
- `…` / `……` 与 `...` / `......` 不等价。
- 不忽略任意标点，不做编辑距离，不跨章节。
- folded 后多次出现不得选择第一个。
- `chapter:015 attempt_01` 即使删除全部标点仍无法对齐词序，必须作为 false-pass 固件。

## 受影响文件

- `.agents/skills/generate-game-kb/scripts/lib/grounding.js`
- `.agents/skills/generate-game-kb/scripts/lib/accepted-chapter.js`
- `.agents/skills/generate-game-kb/scripts/lib/book-assembly.js`
- `.agents/skills/generate-game-kb/tests/grounding.test.js`
- `.agents/skills/generate-game-kb/tests/chapter-receiver.test.js`
- `.agents/skills/generate-game-kb/tests/book-assembly.test.js` 或现有 assembly flow 测试
- `.agents/skills/generate-game-kb/schemas.md`（只记录 Controller 行为，不改变 Worker 权限）

## 复杂度约束

- 不新增依赖。
- 不新增模糊匹配服务或第二套 source index 模块。
- resolver 由 validation 与 accepted projection 复用，避免“验证通过但投影找不到”的漂移。
- allowlist 保持常量表，新增符号必须有失败固件和一对一 offset 证明。

