import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReviewStore } from '../stores/useReviewStore';
import ReviewPage from './ReviewPage';

const loadFiles = vi.fn();
const loadEntities = vi.fn();

function renderReviewPage() {
  return render(
    <MemoryRouter initialEntries={['/review/古龙/神雕侠侣']}>
      <Routes>
        <Route path="/review/:authorName/:bookName" element={<ReviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReviewPage deletion feedback', () => {
  beforeEach(() => {
    loadFiles.mockReset();
    loadEntities.mockReset();
    useReviewStore.getState().clearData();
  });

  it('does not show deletion success after the store reports a failed write', async () => {
    const deleteMarked = vi.fn(async () => {
      useReviewStore.setState({ error: '写入文件失败' });
      return false;
    });
    useReviewStore.setState({
      entities: [{
        key: 'characters:character-1',
        id: 'character-1',
        name: '小龙女',
        type: 'characters',
        summary: '古墓派弟子',
        marked: true,
        data: { id: 'character-1', name: '小龙女' },
      }],
      filter: { type: 'all', status: 'all', search: '' },
      isLoading: false,
      error: null,
      bookPath: '古龙/神雕侠侣',
      loadFiles,
      loadEntities,
      deleteMarked,
    });

    renderReviewPage();
    fireEvent.click(screen.getByRole('button', { name: '删除标记 (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(deleteMarked).toHaveBeenCalledOnce());
    expect(await screen.findByText('写入文件失败')).toBeInTheDocument();
    expect(screen.queryByText('成功删除 1 条数据')).not.toBeInTheDocument();
  });
});
