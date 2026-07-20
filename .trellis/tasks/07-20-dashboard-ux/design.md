# Dashboard 体验优化 - 技术设计

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React)                                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Library.tsx                                        │ │
│  │  ┌─────────────────────────────────────────────┐   │ │
│  │  │  ErrorBoundary (新增)                       │   │ │
│  │  │  ┌─────────────────────────────────────┐   │   │ │
│  │  │  │  Table (responsive)                 │   │   │ │
│  │  │  └─────────────────────────────────────┘   │   │ │
│  │  └─────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Sheet (详情面板)                                   │ │
│  │  ┌─────────────────────────────────────────────┐   │ │
│  │  │  ExecuteButton (新增)                       │   │ │
│  │  │  POST /api/library/execute-action           │   │ │
│  │  └─────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Backend (Vite Plugin)                                   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  libraryApiPlugin.ts                                │ │
│  │  POST /api/library/execute-action (新增)            │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Component Design

### 1. 响应式布局

**策略**：CSS 媒体查询 + 条件渲染

**断点设计**：
- `>= 1280px`：完整表格（8 列）
- `768px - 1279px`：精简表格（6 列，隐藏「可浏览」和「更新时间」）
- `< 768px`：卡片布局

**实现方案**：
```typescript
// 使用 Tailwind 的响应式前缀
<div className="hidden lg:block">
  {/* 完整表格 */}
</div>
<div className="hidden md:block lg:hidden">
  {/* 精简表格 */}
</div>
<div className="block md:hidden">
  {/* 卡片布局 */}
</div>
```

**表格列宽调整**：
- 使用 `minmax()` 替代固定宽度
- 书籍名称列使用 `flex: 1` 自适应

### 2. 详情面板增强

**新增 API**：`POST /api/library/execute-action`

**请求体**：
```typescript
interface ExecuteActionRequest {
  bookPath: string;
  actionType: 'split-chapters' | 'prepare-source' | 'validate-inventory' | 'audit-recall' | 'assess-quality';
}
```

**响应体**：
```typescript
interface ExecuteActionResponse {
  success: boolean;
  output: string;
  error?: string;
}
```

**安全约束**：
- 只允许执行预定义的动作类型（白名单）
- 动作类型映射到具体脚本：
  ```typescript
  const ACTION_SCRIPTS = {
    'split-chapters': 'split-chapters.js',
    'prepare-source': 'prepare-source.js',
    'validate-inventory': 'validate-inventory.js',
    'audit-recall': 'audit-recall.js',
    'assess-quality': 'assess-quality.js',
  };
  ```
- 使用 `child_process.execFile` 执行脚本，限制超时时间（30 秒）

**前端组件**：
```typescript
function ExecuteButton({ bookPath, actionType, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/library/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookPath, actionType }),
      });
      if (!response.ok) throw new Error('执行失败');
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button onClick={execute} disabled={loading}>
        {loading ? '执行中...' : '执行'}
      </Button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
```

### 3. 错误边界

**新增组件**：`dashboard/src/components/ErrorBoundary.tsx`

**实现**：
```typescript
interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border rounded-lg bg-red-50">
          <h3 className="font-medium text-red-800">加载失败</h3>
          <p className="mt-1 text-sm text-red-600">{this.state.error?.message}</p>
          <Button onClick={() => this.setState({ hasError: false })}>
            重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**使用位置**：
- `Library.tsx` 整体包裹
- `BrowseLibrary.tsx` 整体包裹
- 各实体页面（Characters、Skills 等）包裹

## Edge Cases

1. **执行命令超时**：后端设置 30 秒超时，超时后返回错误
2. **执行命令失败**：捕获 stderr，返回给前端显示
3. **并发执行**：前端禁用按钮，防止重复提交
4. **网络错误**：前端 catch 错误，显示重试按钮

## Testing Strategy

1. **单元测试**：
   - ExecuteButton 组件的 loading/error 状态
   - ErrorBoundary 的错误捕获和重置

2. **集成测试**：
   - 执行命令 API 的成功/失败场景
   - 响应式布局在不同宽度下的渲染

3. **E2E 测试**：
   - 完整流程：查看详情 → 执行命令 → 刷新状态
