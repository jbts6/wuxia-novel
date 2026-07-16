# 统一 game-kb 境界字段契约实施计划

## Ordered Checklist

- [x] 更新后端和 Skill 契约测试，确认因缺少 v3 行为进入 RED。
- [x] 新增共享 semantic contract，更新章节、领域、定向补漏、book、final 与 verify 边界。
- [x] 让最终人物和武功只输出 `power_rank`，删除武功旧字段与物品稀有度字段。
- [x] 更新 `SKILL.md`、`schemas.md`、逐章/领域提示词和后端质量规范。
- [x] 更新 Dashboard 原始兼容归一化、应用类型、武功展示和物品页面。
- [x] 运行完整后端测试、Dashboard 测试、lint、build、字段残留扫描和 `git diff --check`。

## Validation Commands

```bash
node --test .agents/skills/generate-game-kb/tests/*.test.js
cd dashboard && npm test -- --run
cd dashboard && npm run lint
cd dashboard && npm run build
git diff --check
git status --short
```

## Risk Controls

- 每个生产行为先有失败测试。
- 不修改现有知识库数据。
- 不触碰用户已有 `dashboard/package-lock.json` 修改。
- 不顺带调整其他流程质量或性能问题。

## Validation Evidence

- 生成器：除 Windows 文件符号链接权限用例外，24 个测试文件共 199 个测试，198 通过、0 失败；`archive.test.js` 其余 4 项通过，符号链接项因 `fs.symlinkSync` 返回 `EPERM` 未执行到产品代码。
- Dashboard：25 个测试文件、92 个测试全部通过。
- Dashboard lint：0 错误；保留 `Library.tsx` 既有 TanStack Table React Compiler 兼容警告。
- Dashboard build：TypeScript 与 Vite 生产构建通过。
- 静态扫描：`schemas.md` 无旧字段，生成器脚本无硬编码 v2，Dashboard 旧字段只存在于原始归一化兼容边界。
- `git diff --check`：通过。
