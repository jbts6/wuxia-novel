# 《雪山飞狐》验收证据

本次 `xueshan-domain-v1-20260715` run 已完成生成、workspace verify、安装、installed verify 和归档。重点质量抽样为 `30/30`，整体抽样为 `39/40`；唯一失败是低优先级地点 `loc_jiu_gong_shan` 的事实描述错误，因此按软门记录 warning，不阻塞安装和归档。

- [xueshan-run-report.json](./xueshan-run-report.json)：run、AI 工作单元、候选数量、九类计数、安装与归档哈希。
- [xueshan-quality-audit.json](./xueshan-quality-audit.json)：40 项固定抽样、重点类别结果和唯一软门 warning。
- 归档源：`金庸/雪山飞狐/_archive/generate-game-kb/xueshan-domain-v1-20260715/`。

本轮不作速度验收。原始阶段耗时保留为可观测数据，但当前模型速度、旧版逐章对白提取和数小时服务不可用共同污染了墙钟时间。用户将使用高效模型单独验证 45/60 分钟速度门。

该 run 保留旧流程提取的 61 条对白；关闭对白后的 fresh run 已由自动化合同固定为 `dialogues: []`，最终仍写出兼容的空 `dialogues.json`。
