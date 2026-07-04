import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBookStore } from '../stores/useBookStore';
import { BookChapter, SealStamp, InkRule } from '../shared/components';

const AUTHOR_SEALS: Record<string, string> = {
  金庸: '金',
  古龙: '古',
  梁羽生: '梁',
  黄易: '黄',
};

const AUTHOR_INTROS: Record<string, string> = {
  金庸: '侠之大者，家国天下',
  古龙: '浪子江湖，奇情诡事',
  梁羽生: '名士风流，历史传奇',
  黄易: '玄幻先驱，时空交织',
};

const Library: React.FC = () => {
  const books = useBookStore(s => s.books);

  const authors = useMemo(() => {
    const map = new Map<string, { count: number; characters: number; skills: number; factions: number }>();
    for (const b of books) {
      const cur = map.get(b.author) ?? { count: 0, characters: 0, skills: 0, factions: 0 };
      cur.count += 1;
      cur.characters += b.characters;
      cur.skills += b.skills;
      cur.factions += b.factions;
      map.set(b.author, cur);
    }
    return Array.from(map.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.characters - a.characters);
  }, [books]);

  const totals = useMemo(() => ({
    books: books.length,
    authors: authors.length,
    characters: authors.reduce((s, a) => s + a.characters, 0),
    skills: authors.reduce((s, a) => s + a.skills, 0),
    factions: authors.reduce((s, a) => s + a.factions, 0),
  }), [authors, books]);

  return (
    <BookChapter title="藏 书 阁" subtitle="四家卷宗，一阁尽览" seal="阁">
      <div
        style={{
          display: 'flex',
          gap: 28,
          padding: '12px 20px',
          marginBottom: 32,
          background: 'var(--paper-raised)',
          border: '1px solid var(--ink-hairline)',
          borderRadius: 2,
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: '书斋', value: totals.authors },
          { label: '卷宗', value: totals.books },
          { label: '人物', value: totals.characters },
          { label: '武功', value: totals.skills },
          { label: '门派', value: totals.factions },
        ].map(s => (
          <div key={s.label} style={{ minWidth: 80 }}>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--cinnabar)',
                lineHeight: 1.2,
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink-secondary)',
                letterSpacing: '0.2em',
                marginTop: 2,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <h2
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 16,
          letterSpacing: '0.2em',
          color: 'var(--ink-black)',
          marginBottom: 20,
        }}
      >
        四 家 书 斋
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 28,
        }}
      >
        {authors.map(a => (
          <Link
            key={a.name}
            to={`/${encodeURIComponent(a.name)}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="book-cover" style={{ maxWidth: 240 }}>
              <span className="book-cover__author">
                <SealStamp text={AUTHOR_SEALS[a.name] ?? a.name.slice(0, 1)} shape="sm" />
              </span>
              <span className="book-cover__title">{a.name}书斋</span>
              <span className="book-cover__seal">
                <SealStamp text="斋" shape="square" />
              </span>
            </div>
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  color: 'var(--ink-black)',
                  lineHeight: 1.3,
                }}
              >
                {a.name}
              </div>
              <p
                style={{
                  marginTop: 6,
                  fontFamily: 'var(--font-serif)',
                  fontSize: 12,
                  color: 'var(--ink-secondary)',
                  letterSpacing: '0.1em',
                }}
              >
                {AUTHOR_INTROS[a.name] ?? '名家卷宗'}
              </p>
              <p
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: 'var(--ink-faint)',
                  letterSpacing: '0.08em',
                }}
              >
                {a.count} 卷 · {a.characters} 人物
              </p>
            </div>
          </Link>
        ))}
      </div>

      {authors.length === 0 && (
        <p
          style={{
            color: 'var(--ink-faint)',
            fontFamily: 'var(--font-serif)',
            padding: '40px 0',
            textAlign: 'center',
          }}
        >
          阁中暂无书斋。
        </p>
      )}

      <InkRule />
    </BookChapter>
  );
};

export default Library;
