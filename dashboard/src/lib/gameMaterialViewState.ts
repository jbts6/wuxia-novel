import type { BookExtrasData } from '../types/novel';

export type GameMaterialViewState = 'loading' | 'unavailable' | 'available' | 'missing' | 'invalid';

export function getGameMaterialViewState(
  extras: BookExtrasData | null,
  isLoading: boolean,
  error: string | null,
): GameMaterialViewState {
  if (isLoading) return 'loading';
  if (error) return 'unavailable';
  if (!extras) return 'loading';
  return extras.gameMaterials.status;
}
