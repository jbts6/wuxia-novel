import React, { useState, useMemo, useCallback } from 'react';
import { Input, Dropdown, Empty, Spin } from 'antd';
import { SearchOutlined, UserOutlined, ThunderboltOutlined, ToolOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';
import { ENTITY_COLORS } from '../../theme/palette';

interface SearchResult {
  id: string;
  name: string;
  type: 'character' | 'skill' | 'item';
  description: string;
}

const GlobalSearch: React.FC = () => {
  const characters = useNovelStore((s) => s.characters);
  const skills = useNovelStore((s) => s.skills);
  const items = useNovelStore((s) => s.items);
  const showDetail = useNovelStore((s) => s.showDetail);
  const loading = useNovelStore((s) => s.loading);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!query || query.length < 1) return [];

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    characters.forEach(char => {
      if (
        char.name.toLowerCase().includes(lowerQuery) ||
        char.alias?.some(a => a.toLowerCase().includes(lowerQuery)) ||
        char.identity?.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: char.id,
          name: char.name,
          type: 'character',
          description: char.identity || char.one_line || '',
        });
      }
    });

    skills.forEach(skill => {
      if (
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.type?.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: skill.id,
          name: skill.name,
          type: 'skill',
          description: skill.one_line || skill.type || '',
        });
      }
    });

    items.forEach(item => {
      if (
        item.name.toLowerCase().includes(lowerQuery) ||
        item.type?.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: item.id,
          name: item.name,
          type: 'item',
          description: item.one_line || item.type || '',
        });
      }
    });

    return results.slice(0, 20);
  }, [query, characters, skills, items]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      character: [],
      skill: [],
      item: [],
    };
    searchResults.forEach(r => groups[r.type]?.push(r));
    return groups;
  }, [searchResults]);

  const handleSelect = useCallback((result: SearchResult) => {
    showDetail(result.type, result.id);
    setOpen(false);
    setQuery('');
  }, [showDetail]);

  const typeIcons: Record<string, React.ReactNode> = {
    character: <UserOutlined style={{ color: ENTITY_COLORS.character }} />,
    skill: <ThunderboltOutlined style={{ color: ENTITY_COLORS.skill }} />,
    item: <ToolOutlined style={{ color: ENTITY_COLORS.item }} />,
  };

  const typeLabels: Record<string, string> = {
    character: '角色',
    skill: '技能',
    item: '物品',
  };

  const dropdownContent = useMemo(() => {
    if (loading) return <Spin size="small" />;
    if (!query) return null;
    if (searchResults.length === 0) {
      return <Empty description="未找到匹配结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {Object.entries(groupedResults).map(([type, results]) => {
          if (results.length === 0) return null;
          return (
            <div key={type} style={{ marginBottom: 8 }}>
              <div style={{
                padding: '4px 12px',
                background: 'var(--paper-sunken)',
                fontWeight: 'bold',
                fontSize: 12,
                color: 'var(--ink-secondary)',
                fontFamily: 'var(--font-serif)',
              }}>
                {typeLabels[type]} ({results.length})
              </div>
              {results.map(result => (
                <div
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--paper-sunken)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {typeIcons[result.type]}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{result.name}</div>
                    <div style={{
                      fontSize: 12,
                      color: 'var(--ink-faint)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {result.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchResults, groupedResults, loading, handleSelect]);

  return (
    <Dropdown
      open={open && query.length > 0}
      trigger={[]}
      popupRender={() => dropdownContent}
      placement="bottomRight"
      styles={{ root: { width: 350, position: 'fixed' } }}
    >
      <Input
        prefix={<SearchOutlined style={{ color: '#999' }} />}
        placeholder="搜索人物、技能、物品..."
        allowClear
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={{ width: 250 }}
      />
    </Dropdown>
  );
};

export default GlobalSearch;
