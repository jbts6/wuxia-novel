import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Spin, Typography } from 'antd';
import { useBookRouteSync } from '../../hooks/useBookRouteSync';
import { useBookStore } from '../../stores/useBookStore';
import { useDataLoader } from '../../hooks/useDataLoader';
import { useNovelStore } from '../../stores/useNovelStore';

const { Text } = Typography;

const BookLayout: React.FC = () => {
  useBookRouteSync();
  const { currentBookPath, books } = useBookStore();
  const data = useDataLoader(currentBookPath);
  const { setData } = useNovelStore();
  const currentBook = books.find(b => b.path === currentBookPath);

  useEffect(() => {
    if (!data.loading && !data.error && currentBookPath) {
      setData(data);
    }
  }, [data, setData, currentBookPath]);

  if (data.loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          gap: 18,
          background: 'var(--paper-base)',
        }}
      >
        <span className="ink-seal" style={{ width: 56, height: 56, fontSize: 28 }}>侠</span>
        <Spin size="large" />
        {currentBook && (
          <Text style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-serif)' }}>
            正在展卷《{currentBook.name}》…
          </Text>
        )}
      </div>
    );
  }

  if (data.error) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: 'var(--paper-base)',
        }}
      >
        <div style={{ textAlign: 'center', color: 'var(--ink-body)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-black)' }}>加载失败</h2>
          <p style={{ color: 'var(--cinnabar)' }}>{data.error}</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default BookLayout;
