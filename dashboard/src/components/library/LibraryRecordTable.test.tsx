import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Skill } from '../../types/novel';
import type { LibraryRecord } from '../../types/library';
import LibraryRecordTable from './LibraryRecordTable';

describe('LibraryRecordTable', () => {
  it('renders source-aware records and opens details', () => {
    const onOpen = vi.fn();
    const records: LibraryRecord<Skill>[] = [
      {
        key: 'skill:book:s1',
        kind: 'skill',
        source: { author: '金庸', bookName: '射雕英雄传', bookPath: '金庸/射雕英雄传' },
        entity: { id: 's1', name: '九阴真经', rank: '返璞归真', type: '内功', one_line: '武学总纲' } as Skill,
      },
    ];

    render(<LibraryRecordTable records={records} onOpen={onOpen} />);

    expect(screen.getByText('九阴真经')).toBeInTheDocument();
    expect(screen.getByText('射雕英雄传')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看' }));
    expect(onOpen).toHaveBeenCalledWith('skill:book:s1');
  });
});
