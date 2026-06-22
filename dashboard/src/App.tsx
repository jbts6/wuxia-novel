import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/layout/AppLayout';
import BookLayout from './components/layout/BookLayout';
import GlobalOverview from './components/library/GlobalOverview';
import Dashboard from './components/Dashboard';
import CharacterGraph from './components/graph/CharacterGraph';
import SkillTree from './components/skills/SkillTree';
import DialogueList from './components/dialogues/DialogueList';
import CharacterList from './components/characters/CharacterList';
import ItemList from './components/items/ItemList';
import ForceList from './components/factions/ForceList';
import DetailPanel from './components/detail/DetailPanel';
import { useBookStore } from './stores/useBookStore';
import { inkTheme } from './theme/inkTheme';

const App: React.FC = () => {
  const { loadBooks } = useBookStore();

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  return (
    <ConfigProvider locale={zhCN} theme={inkTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<GlobalOverview />} />
            <Route path="book/:author/:bookName" element={<BookLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="graph" element={<CharacterGraph />} />
              <Route path="skills" element={<SkillTree />} />
              <Route path="characters" element={<CharacterList />} />
              <Route path="items" element={<ItemList />} />
              <Route path="forces" element={<ForceList />} />
              <Route path="dialogues" element={<DialogueList />} />
            </Route>
          </Route>
        </Routes>
        <DetailPanel />
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
