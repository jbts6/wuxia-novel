# Dashboard 数据层优化

## Goal

提升数据层的健壮性和可维护性，减少硬编码依赖，改进内容覆盖判定逻辑。

## Requirements

### 1. suggestedAction 配置化

**现状**：`libraryScanner.ts` 中 `suggestedActionFor()` 函数的建议命令是硬编码的字符串拼接：

```typescript
const command = `node ${script('split-chapters.js')} ${novel}`;
```

如果脚本重命名或路径变化，会静默失效，没有编译时检查。

**目标**：将建议命令的脚本路径和参数提取为配置，便于维护和扩展。

**方案**：
- 创建 `dashboard/server/actionConfig.ts` 配置文件
- 定义 `ActionConfig` 接口：`{ label, script, args, description }`
- 将现有的 5 个建议动作（切分章节、生成索引、检查覆盖、检查查漏、诊断旧版）定义为配置数组
- `suggestedActionFor()` 改为从配置中查找匹配的动作，而不是硬编码字符串
- 脚本路径变化时只需修改配置文件

### 2. contentCoverage 判定改进

**现状**：`entityContent.ts` 中 `EMPTY_DISPLAY_VALUES` 硬编码了中文空白值列表：

```typescript
const EMPTY_DISPLAY_VALUES = new Set([
  '', 'unknown', '未知',
  '未分类', '未标注', '未注明', '暂无', '暂无简介',
]);
```

如果生成逻辑改了措辞（如「暂无简介」改为「暂无描述」），会漏判。

**目标**：改进判定逻辑，减少对特定措辞的依赖。

**方案**：
- 保留现有的精确匹配列表（作为白名单）
- 增加基于模式的判定：
  - 空字符串或纯空白
  - 只包含标点符号
  - 长度 < 2 的字符串
- 增加单元测试覆盖各种边界情况
- 在 `EMPTY_DISPLAY_VALUES` 中增加注释，说明这些值来自生成逻辑，需要同步维护

## Acceptance Criteria

- [ ] `actionConfig.ts` 文件存在，包含所有建议动作的配置
- [ ] `suggestedActionFor()` 从配置中查找动作，不再硬编码脚本路径
- [ ] 修改配置文件中的脚本路径后，建议命令正确反映变化
- [ ] `EMPTY_DISPLAY_VALUES` 增加模式判定（空字符串、纯标点、过短字符串）
- [ ] 新增单元测试覆盖 contentCoverage 判定的各种边界情况
- [ ] `pnpm check` 通过

## Technical Notes

- 修改范围：`dashboard/server/libraryScanner.ts`（新增 `actionConfig.ts`）、`dashboard/src/lib/entityContent.ts`
- 不改变 API 接口契约
- suggestedAction 的输出格式不变（`{ label, reason, command }`）
- contentCoverage 的判定结果可能变化（更严格），需要验证现有数据
