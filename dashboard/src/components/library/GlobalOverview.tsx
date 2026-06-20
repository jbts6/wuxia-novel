import React, { useState, useMemo } from 'react';
import { Card, Table, Input, Segmented, Typography } from 'antd';
import {
  AppstoreOutlined,
  UnorderedListOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useBookStore, type BookMeta } from '../../stores/useBookStore';

const { Text } = Typography;

const GlobalOverview: React.FC = () => {
  const { books } = useBookStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<string>('grid');

  const authors = useMemo(() => [...new Set(books.map(b => b.author))].sort(), [books]);

  const filtered = useMemo(() => {
    let list = books;
    if (authorFilter) list = list.filter(b => b.author === authorFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    }
    return list;
  }, [books, authorFilter, search]);

  const totals = useMemo(() => ({
    characters: books.reduce((s, b) => s + b.characters, 0),
    skills: books.reduce((s, b) => s + b.skills, 0),
    factions: books.reduce((s, b) => s + b.factions, 0),
  }), [books]);

  const navigateToBook = (book: BookMeta) => {
    navigate(`/book/${encodeURIComponent(book.author)}/${encodeURIComponent(book.name)}`);
  };

  return (
    <div className="overview-container">
      <div className="overview-header">
        <div className="overview-title">
          <span className="ink-seal" style={{ width: 36, height: 36, fontSize: 18 }}>侠</span>
          <h1>武侠图志</h1>
        </div>
        <Text className="overview-stats">
          {books.length} 部作品 · {authors.length} 位作者 · {totals.characters.toLocaleString()} 角色 · {totals.skills.toLocaleString()} 武功 · {totals.factions.toLocaleString()} 门派
        </Text>
      </div>

      <div className="overview-toolbar">
        <div className="author-pills">
          <span
            className={`author-pill ${!authorFilter ? 'active' : ''}`}
            onClick={() => setAuthorFilter(null)}
          >
            全部
          </span>
          {authors.map(a => (
            <span
              key={a}
              className={`author-pill ${authorFilter === a ? 'active' : ''}`}
              onClick={() => setAuthorFilter(a)}
            >
              {a}
            </span>
          ))}
        </div>
        <div className="toolbar-right">
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--ink-faint)' }} />}
            placeholder="搜索书名..."
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="overview-search"
          />
          <Segmented
            value={viewMode}
            onChange={v => setViewMode(v as string)}
            options={[
              { value: 'grid', icon: <AppstoreOutlined /> },
              { value: 'table', icon: <UnorderedListOutlined /> },
            ]}
          />
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="book-card-grid">
          {filtered.map(book => (
            <div key={book.path}>
              <Card
                hoverable
                onClick={() => navigateToBook(book)}
                styles={{ body: { padding: '8px 10px' } }}
                cover={
                  <div className="book-card-cover">
                    <span className="book-card-cover-text">{book.name}</span>
                  </div>
                }
              >
                <div className="book-card-header">
                  <span className="book-card-title">{book.name}</span>
                  <span className="book-card-author">{book.author}</span>
                </div>
                <div className="book-card-meta">
                  {book.characters} 角色 · {book.skills} 武功 · {book.factions} 门派
                </div>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Table
          dataSource={filtered}
          rowKey="path"
          pagination={false}
          size="middle"
          onRow={record => ({
            onClick: () => navigateToBook(record),
            className: 'table-row',
          })}
          columns={[
            {
              title: '书名',
              dataIndex: 'name',
              sorter: (a, b) => a.name.localeCompare(b.name),
              render: (name: string) => <span className="table-book-name">{name}</span>,
            },
            {
              title: '作者',
              dataIndex: 'author',
              filters: authors.map(a => ({ text: a, value: a })),
              onFilter: (value, record) => record.author === value,
            },
            {
              title: '角色',
              dataIndex: 'characters',
              sorter: (a, b) => a.characters - b.characters,
              defaultSortOrder: 'descend',
              align: 'right',
            },
            {
              title: '武功',
              dataIndex: 'skills',
              sorter: (a, b) => a.skills - b.skills,
              align: 'right',
            },
            {
              title: '门派',
              dataIndex: 'factions',
              sorter: (a, b) => a.factions - b.factions,
              align: 'right',
            },
          ]}
        />
      )}
    </div>
  );
};

export default GlobalOverview;
