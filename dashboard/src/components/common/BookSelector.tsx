import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Dropdown, Input, Typography } from 'antd';
import { BookOutlined, DownOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '../../stores/useBookStore';
import InkTag from './InkTag';

const { Text } = Typography;

interface AuthorGroup {
  author: string;
  books: { path: string; name: string; characters: number }[];
}

const BookSelector: React.FC = () => {
  const { books, currentBookPath } = useBookStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [hoveredAuthor, setHoveredAuthor] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authorListRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase();
    const groups: Record<string, typeof books> = {};
    books.forEach(book => {
      if (q && !book.name.toLowerCase().includes(q) && !book.author.toLowerCase().includes(q)) return;
      if (!groups[book.author]) groups[book.author] = [];
      groups[book.author].push(book);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([author, items]) => ({
        author,
        books: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [books, search]);

  const hoveredGroup = useMemo<AuthorGroup | null>(() => {
    if (!hoveredAuthor) return null;
    return filteredGroups.find(g => g.author === hoveredAuthor) ?? null;
  }, [hoveredAuthor, filteredGroups]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setHoveredAuthor(null);
    }, 150);
  }, [clearCloseTimer]);

  const handleAuthorEnter = useCallback((author: string) => {
    clearCloseTimer();
    setHoveredAuthor(author);
  }, [clearCloseTimer]);

  const handleSubmenuEnter = useCallback(() => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  const handleSubmenuLeave = useCallback(() => {
    scheduleClose();
  }, [scheduleClose]);

  const handleBookClick = useCallback((book: { author: string; name: string }) => {
    navigate(`/book/${encodeURIComponent(book.author)}/${encodeURIComponent(book.name)}`);
    setSearch('');
    setHoveredAuthor(null);
  }, [navigate]);

  const currentBook = books.find(b => b.path === currentBookPath);
  const displayText = currentBook
    ? `${currentBook.author} / ${currentBook.name}`
    : '选择书籍';

  const authorListWidth = 160;
  const submenuWidth = 200;
  const menuHeight = 400;

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomLeft"
      open={undefined}
      onOpenChange={(open) => { if (!open) { setSearch(''); setHoveredAuthor(null); } }}
      popupRender={() => (
        <div
          style={{
            display: 'flex',
            background: 'var(--paper-raised)',
            borderRadius: 8,
            border: '1px solid var(--ink-hairline)',
            boxShadow: '0 6px 18px rgba(43,38,32,0.12)',
            overflow: 'hidden',
          }}
        >
          {/* Author list (left panel) */}
          <div style={{ width: authorListWidth, borderRight: hoveredGroup ? '1px solid var(--ink-hairline)' : 'none' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ink-hairline)' }}>
              <Input
                prefix={<SearchOutlined style={{ color: 'var(--ink-faint)' }} />}
                placeholder="搜索书名或作者..."
                allowClear
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div ref={authorListRef} style={{ maxHeight: menuHeight, overflow: 'auto', padding: '4px 0' }}>
              {filteredGroups.length === 0 && (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--ink-faint)' }}>未找到匹配书籍</div>
              )}
              {filteredGroups.map(group => (
                <div
                  key={group.author}
                  onMouseEnter={() => handleAuthorEnter(group.author)}
                  style={{
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontWeight: 'bold',
                    fontSize: 13,
                    fontFamily: 'var(--font-serif)',
                    background: hoveredAuthor === group.author ? 'var(--paper-sunken)' : undefined,
                    color: 'var(--ink-primary)',
                  }}
                  onMouseLeave={() => scheduleClose()}
                >
                  <span>{group.author}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{group.books.length}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Book submenu (right panel) */}
          {hoveredGroup && (
            <div
              ref={submenuRef}
              onMouseEnter={handleSubmenuEnter}
              onMouseLeave={handleSubmenuLeave}
              style={{ width: submenuWidth, maxHeight: menuHeight, overflow: 'auto', padding: '4px 0' }}
            >
              {hoveredGroup.books.map(book => (
                <div
                  key={book.path}
                  onClick={() => handleBookClick(book)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: book.path === currentBookPath ? 'var(--cinnabar-wash)' : undefined,
                  }}
                  onMouseEnter={e => { if (book.path !== currentBookPath) e.currentTarget.style.background = 'var(--paper-sunken)'; }}
                  onMouseLeave={e => { if (book.path !== currentBookPath) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 13 }}>{book.name}</span>
                  <InkTag color="blue" style={{ marginLeft: 8 }}>{book.characters}角色</InkTag>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          padding: '4px 12px',
          borderRadius: 6,
          border: '1px solid var(--ink-hairline)',
          background: 'var(--paper-raised)',
        }}
      >
        <BookOutlined style={{ color: 'var(--cinnabar)' }} />
        <Text style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayText}
        </Text>
        <DownOutlined style={{ fontSize: 10 }} />
      </div>
    </Dropdown>
  );
};

export default BookSelector;
