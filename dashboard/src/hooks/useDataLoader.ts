import { useEffect, useState } from 'react';
import { emptyNovelData, getStaticNovelData, loadNovelData, type NovelData } from '../data/novelData';

interface NovelDataState extends NovelData {
  loading: boolean;
  error: string | null;
}

export function useDataLoader(bookPath: string | null): NovelDataState {
  const [data, setData] = useState<NovelDataState>({
    ...emptyNovelData(),
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!bookPath) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    const staticData = getStaticNovelData();
    if (staticData) {
      setData({
        ...staticData,
        loading: false,
        error: null,
      });
      return;
    }

    const loadData = async () => {
      setData(prev => ({ ...prev, loading: true, error: null }));

      try {
        const loaded = await loadNovelData(bookPath);

        setData({
          ...loaded,
          loading: false,
          error: null,
        });
      } catch (error) {
        setData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : '加载数据失败',
        }));
      }
    };

    loadData();
  }, [bookPath]);

  return data;
}
