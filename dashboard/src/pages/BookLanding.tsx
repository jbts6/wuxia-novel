import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useNovelStore } from '../stores/useNovelStore';
import { SealStamp, VerticalTitle, InkRule } from '../shared/components';

const SECTIONS = [
  { key: 'overview', label: '总 览', seal: '总' },
  { key: 'characters', label: '人 物 志', seal: '人' },
  { key: 'skills', label: '武 学 谱', seal: '武' },
  { key: 'items', label: '器 物 志', seal: '器' },
  { key: 'factions', label: '门 派 志', seal: '门' },
  { key: 'dialogues', label: '对 话 卷', seal: '语' },
] as const;

const BookLanding: React.FC = () => {
  const { author, book } = useParams<{ author: string; book: string }>();
  const decodedAuthor = author ? decodeURIComponent(author) : '';
  const decodedBook = book ? decodeURIComponent(book) : '';
  const navigate = useNavigate();

  const data = useNovelStore();

  const stats = [
    { label: '人物', value: data.characters?.length ?? 0 },
    { label: '武功', value: data.skills?.length ?? 0 },
    { label: '门派', value: data.factions?.length ?? 0 },
    { label: '器物', value: data.items?.length ?? 0 },
    { label: '地点', value: data.locations?.length ?? 0 },
    { label: '对话', value: data.dialogues?.length ?? 0 },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(160px, 220px) 1fr',
          gap: 36,
          alignItems: 'start',
        }}
      >
        <div>
          <Link
            to={`/${encodeURIComponent(decodedAuthor)}`}
            style={{ textDecoration: 'none' }}
          >
            <div className="book-cover" style={{ maxWidth: 220 }}>
              <span className="book-cover__author">
                <SealStamp text={decodedAuthor.slice(0, 1)} shape="sm" />
              </span>
              <span className="book-cover__title">{decodedBook}</span>
              <span className="book-cover__seal">
                <SealStamp text="卷" shape="square" />
              </span>
            </div>
          </Link>
          <p
            style={{
              marginTop: 10,
              textAlign: 'center',
              fontFamily: 'var(--font-serif)',
              color: 'var(--ink-secondary)',
              fontSize: 13,
              letterSpacing: '0.1em',
            }}
          >
            {decodedAuthor} · 著
          </p>
        </div>

        <div>
          <header style={{ marginBottom: 18 }}>
            <VerticalTitle size="large" as="h1">
              {decodedBook}
            </VerticalTitle>
            <p
              style={{
                marginTop: 6,
                fontFamily: 'var(--font-serif)',
                color: 'var(--ink-secondary)',
                letterSpacing: '0.08em',
                fontSize: 13,
              }}
            >
              {`${decodedAuthor} 先生所著卷宗，共收录 ${stats[0].value} 位人物。`}
            </p>
            <InkRule />
          </header>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginBottom: 22,
              padding: '12px 16px',
              background: 'var(--paper-raised)',
              border: '1px solid var(--ink-hairline)',
              borderRadius: 4,
            }}
          >
            {stats.map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
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
                    letterSpacing: '0.18em',
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
              color: 'var(--ink-black)',
              marginBottom: 8,
              fontSize: 16,
              letterSpacing: '0.15em',
            }}
          >
            卷 目
          </h2>
          <div className="scroll-list">
            {SECTIONS.map(sec => (
              <div
                key={sec.key}
                className="scroll-list__item"
                onClick={() => navigate(`${sec.key}`)}
              >
                <SealStamp text={sec.seal} shape="sm" />
                <span
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 16,
                    letterSpacing: '0.2em',
                    color: 'var(--ink-black)',
                  }}
                >
                  {sec.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookLanding;
