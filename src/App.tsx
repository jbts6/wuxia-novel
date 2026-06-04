import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Spin, ConfigProvider, Typography } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './components/Dashboard';
import CharacterGraph from './components/graph/CharacterGraph';
import EventTimeline from './components/timeline/EventTimeline';
import SkillTree from './components/skills/SkillTree';
import DialogueList from './components/dialogues/DialogueList';
import CharacterList from './components/characters/CharacterList';
import ItemList from './components/items/ItemList';
import DetailPanel from './components/detail/DetailPanel';
import { useDataLoader } from './hooks/useDataLoader';
import { useNovelStore } from './stores/useNovelStore';
import { useBookStore } from './stores/useBookStore';

const { Text } = Typography;

const App: React.FC = () => {
  const { currentBookPath, loadBooks, initFromStorage, books } = useBookStore();
  const data = useDataLoader(currentBookPath);
  const { setData, loading: storeLoading, error: storeError } = useNovelStore();

  useEffect(() => {
    initFromStorage();
    loadBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data.loading && !data.error && currentBookPath) {
      setData(data);
    }
  }, [data, setData, currentBookPath]);

  const isLoading = data.loading || storeLoading;
  const error = data.error || storeError;

  const currentBook = books.find(b => b.path === currentBookPath);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          gap: 16,
        }}
      >
        <Spin size="large" />
        {currentBook && (
          <Text type="secondary">正在加载《{currentBook.name}》...</Text>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
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
            <Route path="characters" element={<CharacterList />} />
            <Route path="items" element={<ItemList />} />
            <Route path="dialogues" element={<DialogueList />} />
          </Route>
        </Routes>
        <DetailPanel />
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
