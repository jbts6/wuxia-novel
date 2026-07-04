import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useBookStore } from '../stores/useBookStore';
import { BookChapter, SealStamp } from '../shared/components';

const AUTHOR_SEALS: Record<string, string> = {
  金庸: '金',
  古龙: '古',
  梁羽生: '梁',
  黄易: '黄',
};

const AUTHOR_BIOS: Record<string, string> = {
  金庸: '原名查良镛，武侠小说泰斗，作品气势磅礴，人物众多，融汇儒释道三家思想。',
  古龙: '新派武侠宗师，文风奇诡，擅写浪子与江湖寂寞，笔下多奇情奇事。',
  梁羽生: '新派武侠开山祖师，文风典雅，喜以历史为背景，笔下多儒侠。',
  黄易: '玄幻武侠先驱，融科幻与武侠于一炉，构思宏大。',
};

const AuthorStudy: React.FC = () => {
  const { author } = useParams<{ author: string }>();
  const decodedAuthor = author ? decodeURIComponent(author) : '';
  const books = useBookStore(s => s.books).filter(b => b.author === decodedAuthor);

  return (
    <BookChapter
      title={`${decodedAuthor || '?'} 书 斋`}
      subtitle="点击书卷，展卷阅读"
      seal={AUTHOR_SEALS[decodedAuthor] || decodedAuthor.slice(0, 1) || '?'}
    >
      <p
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 15,
          lineHeight: 2,
          color: 'var(--ink-body)',
          maxWidth: 720,
          marginBottom: 36,
        }}
      >
        {AUTHOR_BIOS[decodedAuthor] || `此斋收录 ${decodedAuthor} 先生 ${books.length} 部卷宗。`}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 28,
        }}
      >
        {books.map(book => (
          <Link
            key={book.path}
            to={`/${encodeURIComponent(book.author)}/${encodeURIComponent(book.name)}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="book-cover">
              <span className="book-cover__author">
                <SealStamp text={book.author.slice(0, 1)} shape="sm" />
              </span>
              <span className="book-cover__title">{book.name}</span>
              <span className="book-cover__seal">
                <SealStamp text="卷" shape="square" />
              </span>
            </div>
            <p
              style={{
                marginTop: 10,
                fontFamily: 'var(--font-serif)',
                color: 'var(--ink-black)',
                textAlign: 'center',
                fontSize: 14,
              }}
            >
              《{book.name}》
            </p>
          </Link>
        ))}
      </div>

      {books.length === 0 && (
        <p style={{ color: 'var(--ink-faint)', fontFamily: 'var(--font-serif)' }}>
          此斋暂无卷宗。
        </p>
      )}
    </BookChapter>
  );
};

export default AuthorStudy;
