import React, { useState, useMemo } from 'react';
import { Dropdown, Input, Tag, Typography } from 'antd';
import { BookOutlined, DownOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '../../stores/useBookStore';

const { Text } = Typography;

const BookSelector: React.FC = () => {
  const { books, currentBookPath } = useBookStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

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

  const currentBook = books.find(b => b.path === currentBookPath);
  const displayText = currentBook
    ? `${currentBook.author} / ${currentBook.name}`
    : '选择书籍';

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomLeft"
      popupRender={() => (
        <div style={{ width: 320, background: 'var(--paper-raised)', borderRadius: 8, border: '1px solid var(--ink-hairline)', boxShadow: '0 6px 18px rgba(43,38,32,0.12)' }}>
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
          <div style={{ maxHeight: 400, overflow: 'auto', padding: '4px 0' }}>
            {filteredGroups.length === 0 && (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--ink-faint)' }}>未找到匹配书籍</div>
            )}
            {filteredGroups.map(group => (
              <div key={group.author}>
                <div style={{ padding: '4px 12px', fontWeight: 'bold', fontSize: 12, color: 'var(--ink-secondary)', background: 'var(--paper-sunken)', fontFamily: 'var(--font-serif)' }}>
                  {group.author}
                </div>
                {group.books.map(book => (
                  <div
                    key={book.path}
                    onClick={() => {
                      navigate(`/book/${encodeURIComponent(book.author)}/${encodeURIComponent(book.name)}`);
                      setSearch('');
                    }}
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
                    <span>{book.name}</span>
                    <Tag color="blue" style={{ marginLeft: 8 }}>{book.characters}角色</Tag>
                  </div>
                ))}
              </div>
            ))}
          </div>
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
