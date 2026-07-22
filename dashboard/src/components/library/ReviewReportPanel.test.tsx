import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReviewSummary } from '../../types/library';
import { ReviewReportPanel } from './ReviewReportPanel';

const currentStatus: ReviewSummary = {
  status: 'current',
  warningCount: 2,
  reportPath: 'reports/game-kb-review.json',
};

const report = {
  report_version: 1,
  source_hash: 'sha256:source',
  final_data_hash: 'sha256:data',
  summary: {
    warning_count: 2,
    by_code: { GENERIC_CANDIDATE_FILTERED: 2 },
    by_category: { characters: 2 },
  },
  entries: [
    {
      code: 'GENERIC_CANDIDATE_FILTERED',
      severity: 'warning',
      category: 'characters',
      name: '店小二',
      chapter_numbers: [1],
      source_refs: [{ chapter: 1, text: '店小二端来一壶酒。' }],
      member_refs: ['ch001:character:店小二'],
      reason: 'confirmed_generic_name',
      resolution: 'filtered',
    },
    {
      code: 'GENERIC_CANDIDATE_FILTERED',
      severity: 'warning',
      category: 'characters',
      name: '黑衣人',
      chapter_numbers: [2, 3],
      source_refs: [{ chapter: 2, text: '黑衣人隐入长街尽头。' }],
      member_refs: ['ch002:character:黑衣人'],
      reason: 'confirmed_generic_name',
      resolution: 'filtered',
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReviewReportPanel', () => {
  it('shows warning count and loads grouped details only on demand', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(report), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ReviewReportPanel bookPath="古龙/测试书" status={currentStatus} />);

    expect(screen.getByText('2 条审查警告')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '查看审查警告' }));

    expect(await screen.findByText('GENERIC_CANDIDATE_FILTERED')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/library/review-report?path=%E5%8F%A4%E9%BE%99%2F%E6%B5%8B%E8%AF%95%E4%B9%A6',
      { cache: 'no-store' },
    );
    const panel = screen.getByTestId('review-report-details');
    expect(within(panel).getByRole('heading', { name: '人物' })).toBeInTheDocument();
    expect(within(panel).getByText('店小二')).toBeInTheDocument();
    expect(within(panel).getByText('第 2、3 章')).toBeInTheDocument();
    expect(within(panel).getAllByText('confirmed_generic_name')).toHaveLength(2);
    expect(within(panel).getByText('店小二端来一壶酒。')).toBeInTheDocument();
  });

  it.each([
    [{ status: 'missing', warningCount: 0, reportPath: null }, '未安装审查报告'],
    [{ status: 'invalid', warningCount: 0, reportPath: 'reports/game-kb-review.json' }, '审查报告无效'],
  ] as const)('renders the %s state without loading', (status, message) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ReviewReportPanel bookPath="古龙/测试书" status={status} />);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '查看审查警告' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks stale details and keeps them available as read-only context', () => {
    render(<ReviewReportPanel
      bookPath="古龙/测试书"
      status={{ status: 'stale', warningCount: 1, reportPath: 'reports/game-kb-review.json' }}
    />);

    expect(screen.getByText('审查报告已过期')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看审查警告' })).toBeInTheDocument();
  });

  it('renders loading and empty report states', async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    })));
    render(<ReviewReportPanel
      bookPath="古龙/测试书"
      status={{ status: 'current', warningCount: 1, reportPath: 'reports/game-kb-review.json' }}
    />);

    fireEvent.click(screen.getByRole('button', { name: '查看审查警告' }));
    expect(screen.getByText('正在加载审查报告')).toBeInTheDocument();

    resolveFetch?.(new Response(JSON.stringify({
      report_version: 1,
      source_hash: 'sha256:source',
      final_data_hash: 'sha256:data',
      summary: { warning_count: 0, by_code: {}, by_category: {} },
      entries: [],
    }), { status: 200 }));

    expect(await screen.findByText('报告中没有可显示的警告')).toBeInTheDocument();
  });
});
