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
