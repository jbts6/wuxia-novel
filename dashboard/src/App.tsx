import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useBookStore } from './stores/useBookStore';
import { inkTheme } from './theme/inkTheme';
import routes from './app/routes';
import DetailPanel from './components/detail/DetailPanel';

const App: React.FC = () => {
  const { loadBooks } = useBookStore();

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  return (
    <ConfigProvider locale={zhCN} theme={inkTheme}>
      <BrowserRouter>
        <div className="app-shell" style={{ height: '100vh', overflow: 'hidden' }}>
          <RenderRoutes routes={routes} />
        </div>
        <DetailPanel />
      </BrowserRouter>
    </ConfigProvider>
  );
};

const RenderRoutes: React.FC<{ routes: typeof import('./app/routes').default }> = ({ routes }) => (
  <Routes>
    {routes.map((route, idx) => (
      <Route key={idx} path={route.path} element={route.element}>
        {route.children?.map((child, cidx) =>
          child.index ? (
            <Route key={`i-${cidx}`} index element={child.element} />
          ) : (
            <Route key={cidx} path={child.path} element={child.element}>
              {child.children?.map((grand, gidx) =>
                grand.index ? (
                  <Route key={`gi-${gidx}`} index element={grand.element} />
                ) : (
                  <Route key={gidx} path={grand.path} element={grand.element} />
                ),
              )}
            </Route>
          ),
        )}
      </Route>
    ))}
  </Routes>
);

export default App;
