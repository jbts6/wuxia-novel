# 同步 Dashboard 与 generate-game-kb v7 状态合同

## Goal

让 Dashboard 能按产物所属流程选择正确的校验合同：`generate-game-kb` v7 使用安装验证证据，旧 `generate-kb` 继续兼容 G1-G5；同时把实体详情覆盖率从“完成门禁”降为信息指标。

## Requirements

- 当书籍存在 `reports/generate_game_kb_install.json` 或其他 v7 安装报告时，Dashboard 必须使用 `generate-game-kb` 的现行安装验证合同，不得要求 `quality_report.json`、G1-G5、旧 `build/` 目录或扫描清单。
- v7 校验必须复用 `generate-game-kb` 的权威安装验证器，验证五个 YAML、`verification-report.json`、`game-kb-review.json`、安装回执及其哈希绑定，避免在 Dashboard 再复制一套简化合同。
- 没有 v7 产物标记的旧知识库继续使用 `quality_report.json` 的 G1-G5 判定，保持现有兼容能力。
- v7 数据只要可浏览且安装验证通过，就应判为完成；实体详情覆盖率不足 100% 不能阻止完成。
- 详情覆盖率继续展示，但文案必须明确它是“详情覆盖”，不能表述为流程未完成或质量门禁失败。
- v7 校验失败时展示权威验证器返回的阻塞项；非阻塞 warning 单独展示，不能把通过结果降级成失败。
- v7 书籍不得再提示运行旧 `assess-quality.js`；建议动作应指向现行 `generate-game-kb` 状态诊断入口。
- 不引入第三方依赖，不修改已安装小说数据，不改变旧 `generate-kb` 产物格式。

## Acceptance Criteria

- [ ] 完整、哈希一致的 v7 安装产物显示“v7 安装验证通过”，`completed=true`，即使详情覆盖率为 partial。
- [ ] v7 安装回执、验证报告或数据哈希损坏时显示校验失败，并列出对应阻塞原因。
- [ ] v7 通过但带 warning 时仍保持通过，并能在 Dashboard 中看到 warning 数量或摘要。
- [ ] v7 书籍的缺失产物列表不再包含 `build/source-index.json`、`build/scan-manifest.json`、`reports/quality_report.json`。
- [ ] 旧 `generate-kb` fixture 仍按 G1-G5 判定通过、失败和 legacy-unproven。
- [ ] 前端不再把通用 passed 固定显示为“G1-G5 通过”，并将 partial/complete 文案改为详情覆盖语义。
- [ ] Dashboard 单元测试、类型检查、lint 与生产构建全部通过。

## Notes

- 当前七本 v7 作品均被旧扫描器误判为 `validationStatus=not-validated`、`completed=false`，但权威 `verifyInstalled` 全部通过。
- 《剑神一笑》当前有一条非阻塞迁移回执 warning，应用于“通过但有提示”的验收场景。
