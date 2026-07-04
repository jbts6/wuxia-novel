import React, { type ReactNode } from 'react';
import { SealStamp, InkRule, VerticalTitle } from './index';

interface BookChapterProps {
  title: string;
  subtitle?: string;
  seal: string;
  sealShape?: 'square' | 'circle' | 'tall';
  children: ReactNode;
  headerExtra?: ReactNode;
}

const BookChapter: React.FC<BookChapterProps> = ({
  title,
  subtitle,
  seal,
  sealShape = 'square',
  children,
  headerExtra,
}) => (
  <div className="book-chapter" style={{ maxWidth: 1200, margin: '0 auto' }}>
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        paddingBottom: 10,
        borderBottom: '1px solid var(--ink-hairline)',
        marginBottom: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <SealStamp text={seal} shape={sealShape} />
        <div>
          <VerticalTitle size="large" as="h1">
            {title}
          </VerticalTitle>
          {subtitle && (
            <p
              style={{
                marginTop: 6,
                color: 'var(--ink-secondary)',
                fontFamily: 'var(--font-serif)',
                letterSpacing: '0.08em',
                fontSize: 12,
              }}
            >
              {subtitle}
            </p>
          )}
          <InkRule />
        </div>
      </div>
      {headerExtra}
    </header>
    <main>{children}</main>
  </div>
);

export default BookChapter;
