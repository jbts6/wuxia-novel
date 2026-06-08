import type { CardType } from '../types/novel';

export interface DetailTarget {
  type: CardType;
  id: string;
}

const DETAIL_TYPES: CardType[] = ['character', 'skill', 'item', 'faction', 'location'];

export function formatDetailParam(target: DetailTarget): string {
  return `${target.type}:${target.id}`;
}

export function parseDetailParam(value: string | null): DetailTarget | null {
  if (!value) return null;

  const separatorIndex = value.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return null;

  const type = value.slice(0, separatorIndex) as CardType;
  const id = value.slice(separatorIndex + 1);
  if (!DETAIL_TYPES.includes(type)) return null;

  return { type, id };
}

export function appendDetailTrail(trail: DetailTarget[], next: DetailTarget): DetailTarget[] {
  const existingIndex = trail.findIndex(
    (item) => item.type === next.type && item.id === next.id,
  );

  if (existingIndex >= 0) {
    return trail.slice(0, existingIndex + 1);
  }

  return [...trail, next].slice(-6);
}

export type DetailSyncAction =
  | { type: 'hide' }
  | { type: 'show'; target: DetailTarget }
  | { type: 'navigate'; detail: string | null }
  | { type: 'none' };

export interface DetailSyncSnapshot {
  urlDetail: string | null;
  panelDetail: string | null;
}

function getPanelDetail(panel: { visible: boolean; type: CardType | null; id: string | null }): string | null {
  return panel.visible && panel.type && panel.id
    ? formatDetailParam({ type: panel.type, id: panel.id })
    : null;
}

function getUrlAction(
  urlDetail: string | null,
  panel: { visible: boolean; type: CardType | null; id: string | null }
): DetailSyncAction {
  const target = parseDetailParam(urlDetail);

  if (!target) {
    return panel.visible ? { type: 'hide' } : { type: 'none' };
  }

  if (!panel.visible || panel.type !== target.type || panel.id !== target.id) {
    return { type: 'show', target };
  }

  return { type: 'none' };
}

export function getDetailSyncAction(
  urlDetail: string | null,
  panel: { visible: boolean; type: CardType | null; id: string | null },
  previous?: DetailSyncSnapshot | null
): DetailSyncAction {
  const panelDetail = getPanelDetail(panel);

  if (previous && urlDetail !== previous.urlDetail) {
    return getUrlAction(urlDetail, panel);
  }

  if (previous && panelDetail !== previous.panelDetail) {
    return { type: 'navigate', detail: panelDetail };
  }

  if (urlDetail) {
    return getUrlAction(urlDetail, panel);
  }

  if (panelDetail) {
    return { type: 'navigate', detail: panelDetail };
  }

  return { type: 'none' };
}
