import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
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
import { useNovelStore } from './stores/useNovelStore';
import { useBookStore } from './stores/useBookStore';
import { getDetailSyncAction } from './utils/detailNavigation';
import { inkTheme } from './theme/inkTheme';

const DetailRouteSync: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { detailPanel, showDetail, hideDetail } = useNovelStore();
  const previousSync = useRef<{ urlDetail: string | null; panelDetail: string | null } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlDetail = params.get('detail');
    const panelDetail = detailPanel.visible && detailPanel.type && detailPanel.id
      ? `${detailPanel.type}:${detailPanel.id}`
      : null;
    const action = getDetailSyncAction(urlDetail, detailPanel, previousSync.current);
    previousSync.current = { urlDetail, panelDetail };

    switch (action.type) {
      case 'hide':
        hideDetail();
        break;
      case 'show':
        showDetail(action.target.type, action.target.id);
        break;
      case 'navigate':
        if (action.detail) {
          params.set('detail', action.detail);
        } else {
          params.delete('detail');
        }
        navigate(
          { pathname: location.pathname, search: params.toString() },
          { replace: false },
        );
        break;
      case 'none':
        break;
    }
  }, [detailPanel, hideDetail, location.pathname, location.search, navigate, showDetail]);

  return null;
};

const App: React.FC = () => {
  const { loadBooks } = useBookStore();

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  return (
    <ConfigProvider locale={zhCN} theme={inkTheme}>
      <BrowserRouter>
        <DetailRouteSync />
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
