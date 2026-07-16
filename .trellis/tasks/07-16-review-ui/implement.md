# 知识库审核页面 - 执行计划

## 阶段 1：后端 API（优先级：高）

### 1.1 创建 reviewApiPlugin.ts

- [x] 创建 `dashboard/server/reviewApiPlugin.ts`
- [x] 实现以下 API 端点：
  - `GET /api/review/read?path=<path>` - 读取 YAML 文件
  - `POST /api/review/write` - 写入 YAML 文件
  - `POST /api/review/backup` - 备份文件
  - `GET /api/review/list?bookPath=<path>` - 列出可审核的文件
- [x] 添加 YAML 解析依赖（js-yaml）

### 1.2 集成到 Vite 配置

- [x] 在 `vite.config.ts` 中添加 reviewApiPlugin
- [ ] 测试 API 端点是否正常工作

## 阶段 2：前端页面（优先级：高）

### 2.1 创建类型定义

- [x] 在 `dashboard/src/types/novel.ts` 中添加 `ReviewEntity` 类型
- [x] 在 `dashboard/src/types/novel.ts` 中添加 `ReviewFilter` 类型

### 2.2 创建 Zustand Store

- [x] 创建 `dashboard/src/stores/useReviewStore.ts`
- [x] 实现状态管理：
  - `entities`: 实体列表
  - `filter`: 筛选条件
  - `loadEntities()`: 加载数据
  - `toggleMark()`: 切换标记
  - `deleteMarked()`: 批量删除
  - `setFilter()`: 设置筛选条件

### 2.3 创建 ReviewPage 组件

- [x] 创建 `dashboard/src/pages/ReviewPage.tsx`
- [x] 实现以下功能：
  - 页面头部（标题、统计信息）
  - 筛选栏（类型、状态、搜索）
  - 卡片网格布局
  - 批量操作按钮（删除、还原）

### 2.4 创建 ReviewCard 组件

- [x] 创建 `dashboard/src/components/review/ReviewCard.tsx`
- [x] 实现以下功能：
  - 显示实体名称和简介
  - 点击切换标记状态
  - 标记为删除的卡片样式（红色边框）

### 2.5 创建 ConfirmDialog 组件

- [x] 创建 `dashboard/src/components/review/ConfirmDialog.tsx`
- [x] 实现删除确认对话框

## 阶段 3：路由和导航（优先级：中）

### 3.1 更新路由配置

- [x] 在 `dashboard/src/App.tsx` 中添加审核页面路由：
  ```tsx
  <Route path="/:authorName/:bookName/review" element={<ReviewPage />} />
  ```

### 3.2 更新侧边栏导航

- [x] 在 `dashboard/src/components/layout/SideNav.tsx` 中添加审核页面入口：
  ```tsx
  <NavLink to="review" icon={CheckSquare}>数据审核</NavLink>
  ```

## 阶段 4：测试和验证（优先级：中）

### 4.1 单元测试

- [x] 测试 YAML 解析功能
- [x] 测试标记状态切换
- [x] 测试筛选逻辑
- [x] 测试批量删除操作

### 4.2 集成测试

- [x] 测试加载书籍数据
- [x] 测试备份文件生成
- [x] 测试文件写入功能

### 4.3 手动测试

- [x] 选择《书剑恩仇录》进行测试
- [x] 审核人物、武功、物品三类实体
- [x] 批量删除并验证文件更新
- [x] 验证备份文件是否正确生成

## 阶段 5：优化和完善（优先级：低）

### 5.1 性能优化

- [ ] 大数据量时的虚拟滚动
- [ ] 防抖搜索

### 5.2 用户体验

- [x] 添加加载状态
- [x] 添加错误提示
- [ ] 添加成功提示

### 5.3 文档

- [ ] 更新 README
- [ ] 添加使用说明

## 依赖项

- `js-yaml`: YAML 解析库
- `@types/js-yaml`: TypeScript 类型定义

## 风险和注意事项

1. **文件路径安全**：API 需要验证文件路径，防止目录遍历攻击
2. **并发操作**：多人同时编辑可能导致数据丢失
3. **备份策略**：备份文件可能占用较多磁盘空间
4. **YAML 格式**：需要保持原有的 YAML 格式和注释
