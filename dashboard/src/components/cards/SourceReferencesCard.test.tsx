import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SourceRef } from '../../types/novel';
import SourceReferencesCard from './SourceReferencesCard';

describe('SourceReferencesCard', () => {
  it('renders the first three source references with chapter and line labels', () => {
    const sourceRefs = [
      {
        chapter: 1,
        line_start: 10,
        line_end: 12,
        text: '第一段原文',
      },
      {
        chapter: 2,
        line_start: 20,
        line_end: 24,
        text: '第二段原文',
      },
      {
        chapter: 3,
        line_start: 30,
        line_end: 36,
        text: '第三段原文',
      },
      {
        chapter: 4,
        line_start: 40,
        line_end: 48,
        text: '第四段原文',
      },
    ] satisfies SourceRef[];

    render(<SourceReferencesCard sourceRefs={sourceRefs} />);

    expect(screen.getByText('原文引用')).toBeInTheDocument();
    expect(screen.getByText('第1章 (行 10-12)')).toBeInTheDocument();
    expect(screen.getByText('第一段原文')).toBeInTheDocument();
    expect(screen.getByText('第2章 (行 20-24)')).toBeInTheDocument();
    expect(screen.getByText('第二段原文')).toBeInTheDocument();
    expect(screen.getByText('第3章 (行 30-36)')).toBeInTheDocument();
    expect(screen.getByText('第三段原文')).toBeInTheDocument();
    expect(screen.queryByText('第4章 (行 40-48)')).not.toBeInTheDocument();
    expect(screen.queryByText('第四段原文')).not.toBeInTheDocument();
  });

  it('renders nothing when there are no source references', () => {
    const { container } = render(<SourceReferencesCard sourceRefs={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
