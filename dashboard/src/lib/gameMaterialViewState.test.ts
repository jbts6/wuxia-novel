import { describe, expect, it } from 'vitest';
import type { BookExtrasData } from '../types/novel';
import { getGameMaterialViewState } from './gameMaterialViewState';

const extras: BookExtrasData = {
  events: { status: 'missing', data: null },
  gameMaterials: { status: 'missing', data: null },
};

describe('getGameMaterialViewState', () => {
  it('shows request failure even when no extras response was cached', () => {
    expect(getGameMaterialViewState(null, false, '扩展接口不可用')).toBe('unavailable');
  });

  it('keeps loading and resource states distinct', () => {
    expect(getGameMaterialViewState(null, true, null)).toBe('loading');
    expect(getGameMaterialViewState(null, false, null)).toBe('loading');
    expect(getGameMaterialViewState(extras, false, null)).toBe('missing');
  });
});
