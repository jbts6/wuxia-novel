# 知识库审核页面 - 技术设计

## 1. 架构概述

审核页面将作为 dashboard 项目的一个新页面，集成到现有的路由系统中。

```
/:authorName/:bookName/review
```

## 2. 数据流

```
YAML 文件 → 解析 → Zustand Store → 卡片组件 → 用户标记 → 批量删除 → 写回 YAML
```

### 2.1 数据加载

1. 读取书籍目录下的 YAML 文件：
   - `data/characters.yaml`
   - `data/skills.yaml`
   - `data/items.yaml`

2. 使用 `js-yaml` 库解析 YAML 为 JavaScript 对象

3. 存储到 Zustand store 中

### 2.2 数据结构

```typescript
interface ReviewEntity {
  id: string;
  name: string;
  type: 'character' | 'skill' | 'item';
  summary: string; // one_line 或 identity 或 description
  marked: boolean; // 是否标记为删除
  data: any; // 原始数据
}
```

## 3. 组件设计

### 3.1 页面结构

```
ReviewPage
├── PageHeader (标题、筛选器、批量操作按钮)
├── FilterBar (类型筛选：人物/武功/物品)
├── CardGrid (卡片网格)
│   └── ReviewCard × N (实体卡片)
└── ConfirmDialog (删除确认对话框)
```

### 3.2 ReviewCard 组件

```tsx
interface ReviewCardProps {
  entity: ReviewEntity;
  onToggleMark: (id: string) => void;
}
```

- 显示实体名称（突出显示）
- 显示简介（one_line 或 identity）
- 点击卡片切换标记状态
- 标记为删除的卡片用红色边框/删除线标识

### 3.3 筛选功能

- 类型筛选：人物、武功、物品
- 搜索框：按名称搜索
- 状态筛选：全部、未标记、已标记

## 4. 状态管理

使用 Zustand store 管理审核状态：

```typescript
interface ReviewStore {
  entities: ReviewEntity[];
  filter: {
    type: 'all' | 'character' | 'skill' | 'item';
    status: 'all' | 'unmarked' | 'marked';
    search: string;
  };
  loadEntities: (bookPath: string) => Promise<void>;
  toggleMark: (id: string) => void;
  deleteMarked: () => Promise<void>;
  setFilter: (filter: Partial<ReviewStore['filter']>) => void;
}
```

## 5. 文件操作

### 5.1 读取 YAML

```typescript
import yaml from 'js-yaml';

async function loadYamlFile(filePath: string): Promise<any[]> {
  const response = await fetch(`/api/review/read?path=${encodeURIComponent(filePath)}`);
  const text = await response.text();
  return yaml.load(text) as any[];
}
```

### 5.2 写入 YAML

```typescript
async function saveYamlFile(filePath: string, data: any[]): Promise<void> {
  const yamlText = yaml.dump(data, { lineWidth: -1 });
  await fetch('/api/review/write', {
    method: 'POST',
    body: JSON.stringify({ path: filePath, content: yamlText }),
  });
}
```

### 5.3 备份文件

备份文件存放在 `data/backups/` 目录下，与原文件分离，便于管理和清理。

```typescript
async function backupFile(filePath: string, bookPath: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = filePath.split('/').pop() || '';
  const backupFileName = fileName.replace(/(\.(yaml|yml|json))$/, `.backup.${timestamp}$1`);
  const backupPath = `${bookPath}/data/backups/${backupFileName}`;
  await fetch('/api/review/backup', {
    method: 'POST',
    body: JSON.stringify({ source: filePath, target: backupPath }),
  });
}
```

**备份目录结构**：
```
金庸/书剑恩仇录/data/
├── characters.json
├── skills.json
├── items.json
└── backups/
    ├── characters.backup.2026-07-16T10-30-00-000Z.json
    ├── skills.backup.2026-07-16T10-30-00-000Z.json
    └── ...
```

**注意**：`backups/` 目录已在 `.gitignore` 中忽略，不会提交到版本控制。

## 6. API 端点

需要在 dashboard server 中添加以下 API：

1. `GET /api/review/read?path=<path>` - 读取 YAML 文件
2. `POST /api/review/write` - 写入 YAML 文件
3. `POST /api/review/backup` - 备份文件
4. `GET /api/review/list?bookPath=<path>` - 列出可审核的文件

## 7. 路由集成

在 `App.tsx` 中添加审核页面路由：

```tsx
<Route path="/:authorName/:bookName/review" element={<ReviewPage />} />
```

## 8. 侧边栏导航

在 `SideNav.tsx` 中添加审核页面入口：

```tsx
<NavLink to="review" icon={CheckSquare}>数据审核</NavLink>
```

## 9. 验证方案

1. **单元测试**：
   - YAML 解析正确性
   - 标记状态切换
   - 筛选逻辑

2. **集成测试**：
   - 加载书籍数据
   - 批量删除操作
   - 备份文件生成

3. **手动测试**：
   - 选择一本书籍
   - 审核各类实体
   - 批量删除并验证文件更新
