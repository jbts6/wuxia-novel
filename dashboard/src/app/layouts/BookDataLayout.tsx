import React, { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { Spin, Typography } from 'antd';
import { useBookStore } from '../../stores/useBookStore';
import { useDataLoader } from '../../hooks/useDataLoader';
import { useNovelStore } from '../../stores/useNovelStore';

const { Text } = Typography;

const BookDataLayout: React.FC = () => {
  const { author, book } = useParams<{ author: string; book: string }>();
  const decodedPath = author && book ? `${decodeURIComponent(author)}/${decodeURIComponent(book)}` : null;

  const books = useBookStore(s => s.books);
  const setData = useNovelStore(s => s.setData);
  const data = useDataLoader(decodedPath);
  const currentBook = books.find(b => b.path === decodedPath);

  useEffect(() => {
    if (!data.loading && !data.error && decodedPath) {
      setData(data);
    }
  }, [data, setData, decodedPath]);

  if (data.loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          gap: 18,
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
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          color: 'var(--ink-body)',
          textAlign: 'center',
        }}
      >
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-black)' }}>加载失败</h2>
          <p style={{ color: 'var(--cinnabar)' }}>{data.error}</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default BookDataLayout;
