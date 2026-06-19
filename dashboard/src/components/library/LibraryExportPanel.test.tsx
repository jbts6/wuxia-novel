import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Skill } from '../../types/novel';
import type { AnnotatedLibraryRecord } from '../../types/library';
import LibraryExportPanel from './LibraryExportPanel';

describe('LibraryExportPanel', () => {
  it('shows export counts and creates a download', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL });

    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLAnchorElement;
      if (tagName === 'a') element.click = click;
      return element;
    });

    const records: AnnotatedLibraryRecord<Skill>[] = [
      {
        key: 'skill:book:s1',
        kind: 'skill',
        source: { author: '金庸', bookName: '射雕英雄传', bookPath: 'book' },
        entity: { id: 's1', name: '九阴真经' } as Skill,
        annotation: null,
      },
    ];

    render(<LibraryExportPanel records={records} />);

    expect(screen.getByText('可导出素材 1 条')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '导出 JSON' }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });
});
