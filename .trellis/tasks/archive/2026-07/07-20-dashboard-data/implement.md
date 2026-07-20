# Dashboard 数据层优化 - 执行计划

## Checklist

### Phase 1: ActionConfig 配置化
- [ ] 创建 `dashboard/server/actionConfig.ts`
  - [ ] 定义 `ActionConfig` 接口
  - [ ] 定义 `ACTION_CONFIGS` 配置数组（7 个动作）
  - [ ] 实现 `findAction()` 查找函数
- [ ] 修改 `libraryScanner.ts`
  - [ ] 导入 `findAction` 函数
  - [ ] 重写 `suggestedActionFor()` 函数，使用配置查找
  - [ ] 移除硬编码的脚本路径拼接
- [ ] 编写 `actionConfig.test.ts`
  - [ ] 测试 `findAction` 在不同状态下的返回值
  - [ ] 测试 `suggestedActionFor` 的输出格式
  - [ ] 测试边界情况（无匹配动作）

### Phase 2: ContentCoverage 判定改进
- [ ] 修改 `dashboard/src/lib/entityContent.ts`
  - [ ] 新增 `isEmptyByPattern()` 函数
  - [ ] 修改 `hasMeaningfulValue()` 函数，增加模式匹配
  - [ ] 在 `EMPTY_DISPLAY_VALUES` 上方添加注释，说明维护要求
- [ ] 修改 `dashboard/src/lib/entityContent.test.ts`
  - [ ] 新增 `isEmptyByPattern` 测试用例
  - [ ] 新增 `hasMeaningfulValue` 改进后的测试用例
  - [ ] 覆盖边界情况：空字符串、纯空白、纯标点、单字符

### Phase 3: 回归验证
- [ ] 运行现有测试，确保没有破坏
  - [ ] `cd dashboard && pnpm test`
- [ ] 验证现有数据的 contentCoverage 判定
  - [ ] 编写临时脚本，检查所有书的 coverage 状态
  - [ ] 对比改进前后的判定结果
  - [ ] 确认没有书丢失 coverage 状态
- [ ] 运行类型检查
  - [ ] `cd dashboard && pnpm check`

### Phase 4: 提交
- [ ] 确认所有测试通过
- [ ] 确认类型检查通过
- [ ] 提交代码

## Validation Commands

```bash
# 类型检查
cd dashboard && pnpm check

# 运行测试
cd dashboard && pnpm test

# 验证 contentCoverage 判定
node -e "
const { hasMeaningfulValue } = require('./dashboard/src/lib/entityContent');
console.log(hasMeaningfulValue('')); // false
console.log(hasMeaningfulValue('   ')); // false
console.log(hasMeaningfulValue('...')); // false
console.log(hasMeaningfulValue('这是描述')); // true
"
```

## Rollback Points

- Phase 1 完成后：ActionConfig 配置化，可恢复硬编码实现
- Phase 2 完成后：ContentCoverage 判定改进，可恢复原始逻辑
- Phase 3 完成后：回归验证通过，可随时提交

## Notes

- Phase 2 的改进可能导致某些书的 coverage 状态变化
- 需要特别关注 `金庸/书剑恩仇录` 等数据质量较低的书
- 如果发现状态变化过大，可能需要调整 `isEmptyByPattern` 的阈值
