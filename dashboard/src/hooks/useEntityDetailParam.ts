import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNovelStore } from '../stores/useNovelStore';
import type { CardType } from '../types/novel';

export function useEntityDetailParam(type: CardType, entities: Array<{ id: string }>) {
  const [searchParams] = useSearchParams();
  const showDetail = useNovelStore((state) => state.showDetail);
  const detailId = searchParams.get('detail');

  useEffect(() => {
    if (detailId && entities.some((entity) => entity.id === detailId)) {
      showDetail(type, detailId);
    }
  }, [detailId, entities, showDetail, type]);
}
