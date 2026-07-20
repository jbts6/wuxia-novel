# Dashboard 数据层优化 - 技术设计

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Server Side                                             │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  libraryScanner.ts                                  │ │
│  │  ┌─────────────────────────────────────────────┐   │ │
│  │  │  actionConfig.ts (新增)                     │   │ │
│  │  │  ┌─────────────────────────────────────┐   │   │ │
│  │  │  │  ACTION_CONFIGS: ActionConfig[]      │   │   │ │
│  │  │  │  findAction(): ActionConfig | null   │   │   │ │
│  │  │  └─────────────────────────────────────┘   │   │ │
│  │  └─────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  entityContent.ts                                   │ │
│  │  ┌─────────────────────────────────────────────┐   │ │
│  │  │  EMPTY_DISPLAY_VALUES (改进)                │   │ │
│  │  │  ┌─────────────────────────────────────┐   │   │ │
│  │  │  │  精确匹配 + 模式匹配                │   │   │ │
│  │  │  └─────────────────────────────────────┘   │   │ │
│  │  └─────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Component Design

### 1. ActionConfig 配置化

**新增文件**：`dashboard/server/actionConfig.ts`

**接口定义**：
```typescript
interface ActionConfig {
  /** 动作类型标识符 */
  type: string;
  /** 显示标签 */
  label: string;
  /** 描述信息 */
  description: string;
  /** 脚本文件名（相对于 PIPELINE_SCRIPT_ROOT） */
  script: string;
  /** 额外的命令行参数（可选） */
  extraArgs?: string[];
  /** 触发条件：generationStage 的值 */
  triggerStage: GenerationStage | GenerationStage[];
  /** 额外的触发条件 */
  triggerCondition?: (status: LibraryBookStatus) => boolean;
}
```

**配置数组**：
```typescript
export const ACTION_CONFIGS: ActionConfig[] = [
  {
    type: 'split-chapters',
    label: '切分章节',
    description: '尚未发现有效的 ch_split 产物。',
    script: 'split-chapters.js',
    triggerStage: 'not-started',
  },
  {
    type: 'prepare-source',
    label: '生成来源索引与扫描清单',
    description: '切章已存在，但缺少可计数的 scan manifest。',
    script: 'prepare-source.js',
    triggerStage: 'prepared',
    triggerCondition: (status) => !status.artifacts.scanManifest,
  },
  {
    type: 'validate-inventory',
    label: '检查候选清单覆盖',
    description: '继续 generate-kb 的扫描或归并阶段，并用校验脚本检查剩余窗口和 ledger。',
    script: 'validate-inventory.js',
    triggerStage: ['scanning', 'pending-merge'],
  },
  {
    type: 'audit-recall',
    label: '检查独立查漏',
    description: 'named-inventory 与 event-dialogue 已完成，仍需完成独立 gap audit。',
    script: 'audit-recall.js',
    triggerStage: 'pending-gap',
  },
  {
    type: 'audit-recall-legacy',
    label: '诊断旧版知识库',
    description: '消费数据可浏览，但尚未经过新版 G1-G5 证明。',
    script: 'audit-recall.js',
    extraArgs: ['--legacy'],
    triggerStage: 'data-produced',
    triggerCondition: (status) => status.validationStatus === 'legacy-unproven',
  },
  {
    type: 'assess-quality',
    label: '检查质量门禁',
    description: '数据已产出，但质量报告尚未证明 G1-G5 全部通过。',
    script: 'assess-quality.js',
    extraArgs: ['--report-only', '--dry-run'],
    triggerStage: 'data-produced',
    triggerCondition: (status) => status.validationStatus !== 'passed',
  },
  {
    type: 'fill-content',
    label: '补全实体内容',
    description: '实体文件已经存在，但只有部分条目包含结构化详情。',
    script: null, // 无脚本，需要手动处理
    triggerStage: 'data-produced',
    triggerCondition: (status) => 
      status.contentCoverage.state === 'index-only' || 
      status.contentCoverage.state === 'partial',
  },
];
```

**查找函数**：
```typescript
export function findAction(status: LibraryBookStatus): ActionConfig | null {
  return ACTION_CONFIGS.find((config) => {
    const stageMatch = Array.isArray(config.triggerStage)
      ? config.triggerStage.includes(status.generationStage)
      : config.triggerStage === status.generationStage;
    const conditionMatch = config.triggerCondition
      ? config.triggerCondition(status)
      : true;
    return stageMatch && conditionMatch;
  }) ?? null;
}
```

**suggestedActionFor 改造**：
```typescript
function suggestedActionFor(
  bookPath: string,
  status: LibraryBookStatus,
): SuggestedAction | null {
  const config = findAction(status);
  if (!config || !config.script) return null;

  const novel = shellQuote(bookPath);
  const script = shellQuote(`${PIPELINE_SCRIPT_ROOT}/${config.script}`);
  const args = config.extraArgs ? config.extraArgs.join(' ') : '';
  
  return {
    label: config.label,
    reason: config.description,
    command: `node ${script} ${novel} ${args}`.trim(),
  };
}
```

### 2. ContentCoverage 判定改进

**改进策略**：在精确匹配的基础上增加模式匹配

**新增函数**：
```typescript
function isEmptyByPattern(value: string): boolean {
  const trimmed = value.trim();
  // 空字符串或纯空白
  if (trimmed.length === 0) return true;
  // 只包含标点符号（中文和英文）
  if (/^[\s\p{P}]+$/u.test(trimmed)) return true;
  // 长度 < 2 的无意义字符串
  if (trimmed.length < 2) return true;
  return false;
}
```

**改进 hasMeaningfulValue**：
```typescript
function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === 'string') {
    // 先检查精确匹配
    if (EMPTY_DISPLAY_VALUES.has(value.trim().toLocaleLowerCase('en-US'))) {
      return false;
    }
    // 再检查模式匹配
    if (isEmptyByPattern(value)) {
      return false;
    }
    return true;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (isRecord(value)) return Object.values(value).some(hasMeaningfulValue);
  return false;
}
```

**新增测试用例**：
```typescript
describe('hasMeaningfulValue', () => {
  it('returns false for empty string', () => {
    expect(hasMeaningfulValue('')).toBe(false);
  });

  it('returns false for whitespace only', () => {
    expect(hasMeaningfulValue('   ')).toBe(false);
  });

  it('returns false for punctuation only', () => {
    expect(hasMeaningfulValue('...')).toBe(false);
    expect(hasMeaningfulValue('，，，')).toBe(false);
  });

  it('returns false for single character', () => {
    expect(hasMeaningfulValue('a')).toBe(false);
    expect(hasMeaningfulValue('的')).toBe(false);
  });

  it('returns true for meaningful text', () => {
    expect(hasMeaningfulValue('这是描述')).toBe(true);
    expect(hasMeaningfulValue('hello world')).toBe(true);
  });
});
```

## Edge Cases

1. **配置文件为空**：`ACTION_CONFIGS` 为空数组时，`findAction` 返回 null，`suggestedActionFor` 返回 null
2. **脚本文件不存在**：命令会执行失败，由前端显示错误
3. **contentCoverage 判定变化**：更严格的判定可能导致某些书的 coverage 状态从 `complete` 变为 `partial`，需要验证现有数据
4. **Unicode 标点**：使用 `\p{P}` 正则匹配所有 Unicode 标点符号

## Testing Strategy

1. **单元测试**：
   - ActionConfig 的查找逻辑
   - `isEmptyByPattern` 的各种边界情况
   - `hasMeaningfulValue` 的改进逻辑

2. **集成测试**：
   - `suggestedActionFor` 的输出格式
   - 不同状态下的建议动作

3. **回归测试**：
   - 验证现有数据的 contentCoverage 判定结果
   - 确保没有书因为判定变化而丢失 coverage 状态
