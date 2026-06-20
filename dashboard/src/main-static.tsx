import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/layout/AppLayout';
import BookLayout from './components/layout/BookLayout';
import Dashboard from './components/Dashboard';
import CharacterGraph from './components/graph/CharacterGraph';
import SkillTree from './components/skills/SkillTree';
import DialogueList from './components/dialogues/DialogueList';
import CharacterList from './components/characters/CharacterList';
import ItemList from './components/items/ItemList';
import ForceList from './components/factions/ForceList';
import DetailPanel from './components/detail/DetailPanel';
import { inkTheme } from './theme/inkTheme';
import './index.css';

interface StaticBookMeta {
  path: string;
  author: string;
  name: string;
  characters: number;
}

const bookMeta = (window as unknown as { __BOOK_META__?: StaticBookMeta }).__BOOK_META__;
const basePath = bookMeta
  ? `/book/${encodeURIComponent(bookMeta.author)}/${encodeURIComponent(bookMeta.name)}`
  : '/';

const App: React.FC = () => (
  <ConfigProvider locale={zhCN} theme={inkTheme}>
    <MemoryRouter initialEntries={[basePath]}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
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
    </MemoryRouter>
  </ConfigProvider>
);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

export default App;
