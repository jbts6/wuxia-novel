# 多书籍支持 + 全局搜索 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现多书籍切换查看功能，支持二级菜单选择器和全局搜索

**Architecture:** 
- 新增useBookStore管理书籍状态
- Vite插件读取本地JSON文件
- 二级菜单选择器 + Dropdown搜索结果

**Tech Stack:** React 18, Zustand, Ant Design, Vite

---

## 文件结构

| 操作 | 文件                                   | 说明                           |
| ---- | -------------------------------------- | ------------------------------ |
| 新增 | `public/data/books.json`                 | 书籍元数据                     |
| 新增 | `scripts/generate-books-meta.js`         | 生成books.json的Node脚本       |
| 新增 | `src/stores/useBookStore.ts`             | 书籍状态管理                   |
| 新增 | `src/components/common/BookSelector.tsx` | 二级菜单选择器                 |
| 新增 | `src/components/common/GlobalSearch.tsx` | 全局搜索Dropdown               |
| 修改 | `vite.config.ts`                         | 添加Vite插件读取本地JSON       |
| 修改 | `src/hooks/useDataLoader.ts`             | 支持动态路径                   |
| 修改 | `src/stores/useNovelStore.ts`            | 添加currentBookPath            |
| 修改 | `src/components/layout/AppLayout.tsx`    | 集成选择器和搜索               |
| 修改 | `src/App.tsx`                            | 初始化加载书籍列表             |

---

### Task 1: 生成书籍元数据

**Files:**
- Create: `scripts/generate-books-meta.js`
- Create: `public/data/books.json`

- [ ] **Step 1: 创建生成脚本**

```javascript
// scripts/generate-books-meta.js
const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const results = [];

// 扫描所有作者目录
const excludeDirs = ['node_modules', 'dist', 'src', 'tools', 'docs', 'framework', 'openspec', 'scripts', '.agents', '.claude', '.codegraph', '.obsidian', '.opencode'];

const authors = fs.readdirSync(baseDir).filter(d => {
  try {
    return fs.statSync(path.join(baseDir, d)).isDirectory() && 
           !d.startsWith('.') && 
           !excludeDirs.includes(d);
  } catch { return false; }
});

authors.forEach(author => {
  const authorPath = path.join(baseDir, author);
  const books = fs.readdirSync(authorPath).filter(d => {
    try { return fs.statSync(path.join(authorPath, d)).isDirectory(); } 
    catch { return false; }
  });
  
  books.forEach(book => {
    const bookPath = path.join(authorPath, book);
    const charsFile = path.join(bookPath, 'characters.json');
    
    if (fs.existsSync(charsFile)) {
      try {
        const chars = JSON.parse(fs.readFileSync(charsFile, 'utf-8'));
        const charCount = Array.isArray(chars) ? chars.length : 0;
        
        if (charCount > 0) {
          results.push({
            path: `${author}/${book}`,
            author,
            name: book,
            characters: charCount
          });
        }
      } catch (e) {}
    }
  });
});

// 按作者和书名排序
results.sort((a, b) => {
  if (a.author !== b.author) return a.author.localeCompare(b.author);
  return a.name.localeCompare(b.name);
});

// 输出
const outputPath = path.join(__dirname, '..', 'public', 'data', 'books.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');

console.log(`生成书籍元数据完成，共 ${results.length} 本：`);
results.forEach(r => console.log(`  ${r.author} / ${r.name} (${r.characters}角色)`));
```

- [ ] **Step 2: 运行脚本生成books.json**

```bash
node scripts/generate-books-meta.js
```

预期输出：
```
生成书籍元数据完成，共 17 本：
  古龙 / 圆月弯刀 (135角色)
  古龙 / 多情剑客无情剑 (32角色)
  ...
```

- [ ] **Step 3: 验证生成的文件**

```bash
cat public/data/books.json | head -20
```

预期：JSON格式正确，包含17本书籍信息

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-books-meta.js public/data/books.json
git commit -m "feat: 生成书籍元数据脚本和books.json"
```

---

### Task 2: Vite插件读取本地JSON

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: 添加Vite插件配置**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    {
      name: 'novel-data-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          
          // 处理 /api/novel/* 请求
          if (url.pathname.startsWith('/api/novel/')) {
            const bookParam = url.searchParams.get('book');
            const filePath = url.pathname.replace('/api/novel/', '');
            
            if (bookParam && filePath) {
              try {
                // 解析书籍路径（如 "金庸/天龙八部"）
                const fullPath = path.resolve(__dirname, bookParam, filePath);
                
                // 安全检查：确保路径在项目目录内
                const resolvedBase = path.resolve(__dirname);
                if (!fullPath.startsWith(resolvedBase)) {
                  res.statusCode = 403;
                  res.end('Forbidden');
                  return;
                }
                
                // 读取文件
                const data = fs.readFileSync(fullPath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(data);
              } catch (e) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'File not found' }));
              }
              return;
            }
          }
          
          next();
        });
      }
    }
  ],
})
```

- [ ] **Step 2: 测试API访问**

启动开发服务器后，访问：
```
http://localhost:5173/api/novel/characters.json?book=古龙/多情剑客无情剑
```

预期：返回characters.json的内容

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: 添加Vite插件读取本地JSON数据"
```

---

### Task 3: 创建useBookStore

**Files:**
- Create: `src/stores/useBookStore.ts`

- [ ] **Step 1: 创建书籍状态管理**

```typescript
// src/stores/useBookStore.ts
import { create } from 'zustand';

export interface BookMeta {
  path: string;
  author: string;
  name: string;
  characters: number;
}

interface BookStore {
  // 书籍列表
  books: BookMeta[];
  // 当前选中的书籍路径
  currentBookPath: string | null;
  // 加载状态
  loading: boolean;
  // 错误信息
  error: string | null;
  
  // Actions
  loadBooks: () => Promise<void>;
  selectBook: (bookPath: string) => void;
  initFromStorage: () => void;
}

const STORAGE_KEY = 'novel-dashboard-last-book';

export const useBookStore = create<BookStore>((set, get) => ({
  books: [],
  currentBookPath: null,
  loading: false,
  error: null,
  
  loadBooks: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/data/books.json');
      if (!response.ok) throw new Error('Failed to load books');
      const books = await response.json();
      
      // 如果没有选中书籍，默认选中第一本
      const { currentBookPath } = get();
      if (!currentBookPath && books.length > 0) {
        set({ books, currentBookPath: books[0].path, loading: false });
      } else {
        set({ books, loading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载书籍列表失败', loading: false });
    }
  },
  
  selectBook: (bookPath: string) => {
    set({ currentBookPath: bookPath, loading: true });
    // 保存到localStorage
    try {
      localStorage.setItem(STORAGE_KEY, bookPath);
    } catch (e) {}
  },
  
  initFromStorage: () => {
    try {
      const lastBook = localStorage.getItem(STORAGE_KEY);
      if (lastBook) {
        set({ currentBookPath: lastBook });
      }
    } catch (e) {}
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/useBookStore.ts
git commit -m "feat: 创建useBookStore管理书籍状态"
```

---

### Task 4: 修改数据加载支持动态路径

**Files:**
- Modify: `src/hooks/useDataLoader.ts`

- [ ] **Step 1: 修改useDataLoader支持动态路径**

```typescript
// src/hooks/useDataLoader.ts
import { useEffect, useState } from 'react';
import type {
  Character,
  Skill,
  Technique,
  Item,
  Event,
  Location,
  Faction,
  Dialogue,
} from '../types/novel';

interface NovelData {
  characters: Character[];
  skills: Skill[];
  techniques: Technique[];
  items: Item[];
  events: Event[];
  locations: Location[];
  factions: Faction[];
  dialogues: Dialogue[];
  loading: boolean;
  error: string | null;
}

export function useDataLoader(bookPath: string | null): NovelData {
  const [data, setData] = useState<NovelData>({
    characters: [],
    skills: [],
    techniques: [],
    items: [],
    events: [],
    locations: [],
    factions: [],
    dialogues: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!bookPath) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    const loadData = async () => {
      setData(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const encodedBook = encodeURIComponent(bookPath);
        const fetchFile = (file: string) =>
          fetch(`/api/novel/${file}?book=${encodedBook}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load ${file}`);
            return r.json();
          });

        const [
          characters,
          skills,
          techniques,
          items,
          events,
          locations,
          factions,
          dialogues,
        ] = await Promise.all([
          fetchFile('characters.json'),
          fetchFile('skills.json'),
          fetchFile('techniques.json'),
          fetchFile('items.json'),
          fetchFile('events.json'),
          fetchFile('locations.json'),
          fetchFile('factions.json'),
          fetchFile('dialogues.json'),
        ]);

        setData({
          characters,
          skills,
          techniques,
          items,
          events,
          locations,
          factions,
          dialogues,
          loading: false,
          error: null,
        });
      } catch (error) {
        setData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : '加载数据失败',
        }));
      }
    };

    loadData();
  }, [bookPath]);

  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useDataLoader.ts
git commit -m "feat: 修改useDataLoader支持动态书籍路径"
```

---

### Task 5: 修改NovelStore支持动态数据

**Files:**
- Modify: `src/stores/useNovelStore.ts`

- [ ] **Step 1: 添加currentBookPath状态**

在NovelStore接口中添加：
```typescript
interface NovelStore {
  // 添加这个字段
  currentBookPath: string | null;
  
  // ... 其他现有字段
  
  // 添加这个方法
  setBookPath: (path: string | null) => void;
}
```

在create函数中添加实现：
```typescript
export const useNovelStore = create<NovelStore>((set, get) => ({
  // 添加这个初始值
  currentBookPath: null,
  
  // ... 其他现有状态
  
  // 添加这个方法
  setBookPath: (path: string | null) => {
    set({ currentBookPath: path });
  },
  
  // ... 其他现有方法
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/useNovelStore.ts
git commit -m "feat: NovelStore添加currentBookPath状态"
```

---

### Task 6: 创建BookSelector组件

**Files:**
- Create: `src/components/common/BookSelector.tsx`

- [ ] **Step 1: 创建二级菜单选择器**

```tsx
// src/components/common/BookSelector.tsx
import React from 'react';
import { Dropdown, Tag, Typography } from 'antd';
import { BookOutlined, DownOutlined } from '@ant-design/icons';
import { useBookStore } from '../../stores/useBookStore';

const { Text } = Typography;

const BookSelector: React.FC = () => {
  const { books, currentBookPath, selectBook } = useBookStore();
  
  // 按作者分组
  const groupedBooks = React.useMemo(() => {
    const groups: Record<string, typeof books> = {};
    books.forEach(book => {
      if (!groups[book.author]) {
        groups[book.author] = [];
      }
      groups[book.author].push(book);
    });
    return Object.entries(groups).map(([author, books]) => ({
      author,
      books: books.sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, [books]);
  
  // 获取当前书籍名称
  const currentBook = books.find(b => b.path === currentBookPath);
  const displayText = currentBook 
    ? `${currentBook.author} / ${currentBook.name}`
    : '选择书籍';

  // 构建菜单项
  const menuItems = groupedBooks.map(group => ({
    key: group.author,
    label: group.author,
    type: 'group' as const,
    children: group.books.map(book => ({
      key: book.path,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{book.name}</span>
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {book.characters}角色
          </Tag>
        </div>
      ),
      onClick: () => selectBook(book.path),
    })),
  }));

  return (
    <Dropdown
      menu={{ items }}
      trigger={['click']}
      placement="bottomLeft"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          padding: '4px 12px',
          borderRadius: 6,
          border: '1px solid #d9d9d9',
          background: '#fff',
        }}
      >
        <BookOutlined style={{ color: '#1890ff' }} />
        <Text style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayText}
        </Text>
        <DownOutlined style={{ fontSize: 10 }} />
      </div>
    </Dropdown>
  );
};

export default BookSelector;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/BookSelector.tsx
git commit -m "feat: 创建BookSelector二级菜单选择器"
```

---

### Task 7: 创建GlobalSearch组件

**Files:**
- Create: `src/components/common/GlobalSearch.tsx`

- [ ] **Step 1: 创建全局搜索组件**

```tsx
// src/components/common/GlobalSearch.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { Input, Dropdown, Tag, Typography, Empty, Spin } from 'antd';
import { SearchOutlined, UserOutlined, ThunderboltOutlined, ToolOutlined, BookOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';

const { Text } = Typography;

interface SearchResult {
  id: string;
  name: string;
  type: 'character' | 'skill' | 'item' | 'event';
  description: string;
}

const GlobalSearch: React.FC = () => {
  const { characters, skills, items, events, showDetail, loading } = useNovelStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  // 搜索结果
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!query || query.length < 1) return [];
    
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // 搜索角色
    characters.forEach(char => {
      if (
        char.name.toLowerCase().includes(lowerQuery) ||
        char.alias?.some(a => a.toLowerCase().includes(lowerQuery)) ||
        char.identity?.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: char.id,
          name: char.name,
          type: 'character',
          description: char.identity || char.one_line || '',
        });
      }
    });

    // 搜索技能
    skills.forEach(skill => {
      if (
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.type?.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: skill.id,
          name: skill.name,
          type: 'skill',
          description: skill.one_line || skill.type || '',
        });
      }
    });

    // 搜索物品
    items.forEach(item => {
      if (
        item.name.toLowerCase().includes(lowerQuery) ||
        item.type?.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: item.id,
          name: item.name,
          type: 'item',
          description: item.one_line || item.type || '',
        });
      }
    });

    // 搜索事件
    events.forEach(event => {
      if (event.name.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: event.id,
          name: event.name,
          type: 'event',
          description: `第${event.chapter}章 - ${event.description?.slice(0, 50) || ''}`,
        });
      }
    });

    return results.slice(0, 20); // 限制结果数量
  }, [query, characters, skills, items, events]);

  // 按类型分组
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      character: [],
      skill: [],
      item: [],
      event: [],
    };
    searchResults.forEach(r => groups[r.type]?.push(r));
    return groups;
  }, [searchResults]);

  const handleSelect = useCallback((result: SearchResult) => {
    showDetail(result.type, result.id);
    setOpen(false);
    setQuery('');
  }, [showDetail]);

  // 图标映射
  const typeIcons: Record<string, React.ReactNode> = {
    character: <UserOutlined style={{ color: '#1890ff' }} />,
    skill: <ThunderboltOutlined style={{ color: '#52c41a' }} />,
    item: <ToolOutlined style={{ color: '#faad14' }} />,
    event: <BookOutlined style={{ color: '#ff4d4f' }} />,
  };

  const typeLabels: Record<string, string> = {
    character: '角色',
    skill: '技能',
    item: '物品',
    event: '事件',
  };

  // 构建下拉菜单内容
  const dropdownContent = useMemo(() => {
    if (loading) return <Spin size="small" />;
    if (!query) return null;
    if (searchResults.length === 0) {
      return <Empty description="未找到匹配结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {Object.entries(groupedResults).map(([type, results]) => {
          if (results.length === 0) return null;
          return (
            <div key={type} style={{ marginBottom: 8 }}>
              <div style={{ 
                padding: '4px 12px', 
                background: '#fafafa', 
                fontWeight: 'bold',
                fontSize: 12,
                color: '#666',
              }}>
                {typeLabels[type]} ({results.length})
              </div>
              {results.map(result => (
                <div
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {typeIcons[result.type]}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{result.name}</div>
                    <div style={{ 
                      fontSize: 12, 
                      color: '#999',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {result.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }, [query, searchResults, groupedResults, loading, handleSelect]);

  return (
    <Dropdown
      open={open && query.length > 0}
      trigger={[]}
      dropdownRender={() => dropdownContent}
      placement="bottomRight"
      styles={{ dropdown: { width: 350 } }}
    >
      <Input
        prefix={<SearchOutlined style={{ color: '#999' }} />}
        placeholder="搜索人物、技能、物品..."
        allowClear
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={{ width: 250 }}
      />
    </Dropdown>
  );
};

export default GlobalSearch;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/GlobalSearch.tsx
git commit -m "feat: 创建GlobalSearch全局搜索组件"
```

---

### Task 8: 修改AppLayout集成组件

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`

- [ ] **Step 1: 修改AppLayout集成BookSelector和GlobalSearch**

```tsx
// 修改Header部分，添加BookSelector和GlobalSearch
import BookSelector from '../common/BookSelector';
import GlobalSearch from '../common/GlobalSearch';

// 在Header中替换搜索框为GlobalSearch组件
<Header
  style={{
    padding: '0 24px',
    background: colorBgContainer,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #f0f0f0',
  }}
>
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <BookSelector />
    <h1 style={{ margin: 0, fontSize: 18 }}>武侠小说可视化</h1>
  </div>
  <GlobalSearch />
</Header>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/AppLayout.tsx
git commit -m "feat: AppLayout集成BookSelector和GlobalSearch"
```

---

### Task 9: 修改App.tsx初始化逻辑

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 修改App.tsx使用动态数据加载**

```tsx
import { useBookStore } from './stores/useBookStore';
import { useDataLoader } from './hooks/useDataLoader';
import { useNovelStore } from './stores/useNovelStore';

const App: React.FC = () => {
  const { currentBookPath, loadBooks, initFromStorage } = useBookStore();
  const data = useDataLoader(currentBookPath);
  const { setData, loading: storeLoading, error: storeError } = useNovelStore();

  // 初始化：加载书籍列表
  useEffect(() => {
    initFromStorage();
    loadBooks();
  }, []);

  // 当数据加载完成时，更新store
  useEffect(() => {
    if (!data.loading && !data.error && currentBookPath) {
      setData(data);
    }
  }, [data, setData, currentBookPath]);

  // 加载状态
  const isLoading = data.loading || storeLoading;
  const error = data.error || storeError;

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: 16,
      }}>
        <Spin size="large" />
        {currentBookPath && (
          <Text type="secondary">正在加载《{currentBookPath.split('/')[1]}》...</Text>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <div>
          <h2>加载失败</h2>
          <p>{error}</p>
          <p>请确保数据文件存在于正确位置</p>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="graph" element={<CharacterGraph />} />
            <Route path="timeline" element={<EventTimeline />} />
            <Route path="skills" element={<SkillTree />} />
            <Route path="dialogues" element={<DialogueList />} />
          </Route>
        </Routes>
        <DetailPanel />
      </BrowserRouter>
    </ConfigProvider>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: App.tsx支持动态书籍加载"
```

---

### Task 10: 测试验证

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 验证书籍选择器**

- 打开页面，检查顶部是否有书籍选择器
- 点击选择器，检查是否显示二级菜单
- 选择不同书籍，检查是否正常切换

- [ ] **Step 3: 验证全局搜索**

- 在搜索框输入角色名（如"李寻欢"）
- 检查是否显示搜索结果Dropdown
- 点击结果，检查是否打开详情面板

- [ ] **Step 4: 验证数据持久化**

- 切换到某本书
- 刷新页面
- 检查是否自动加载上次的书籍

- [ ] **Step 5: 验证所有书籍**

逐一选择所有17本书，检查数据是否正确加载

---

## 执行顺序

建议按以下顺序执行：

1. Task 1: 生成书籍元数据
2. Task 2: Vite插件配置
3. Task 3: useBookStore
4. Task 4: useDataLoader修改
5. Task 5: NovelStore修改
6. Task 6: BookSelector组件
7. Task 7: GlobalSearch组件
8. Task 8: AppLayout修改
9. Task 9: App.tsx修改
10. Task 10: 测试验证

每个Task完成后可以独立测试，也可以批量执行后统一测试。
