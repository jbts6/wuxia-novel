import { describe, expect, it } from 'vitest';
import { normalizeBookExtras } from './normalizeBookExtras';

describe('normalizeBookExtras', () => {
  it('normalizes available events and game materials without losing cross-chapter evidence', () => {
    const result = normalizeBookExtras({
      events: {
        status: 'available',
        data: [
          {
            id: 'event_1',
            name: '雪山追踪',
            process: '众人追踪线索。',
            participants: ['char_1'],
            locations: ['loc_1'],
            source_refs: [{ chapter: 1, text: '起因' }, { chapter: 3, text: '结果' }],
          },
        ],
      },
      gameMaterials: {
        status: 'available',
        data: {
          schema_version: 1,
          entries: [
            {
              material_type: '经典剧情桥段',
              source_id: 'event_1',
              relevance: '高',
              suggested_use: '主线桥段',
              reason: '具有追踪与反转结构。',
            },
          ],
        },
      },
    });

    expect(result.events).toMatchObject({
      status: 'available',
      data: [
        {
          id: 'event_1',
          importance: '',
          cause: '',
          result: '',
          participants: ['char_1'],
          locations: ['loc_1'],
          source_refs: [{ chapter: 1 }, { chapter: 3 }],
        },
      ],
    });
    expect(result.gameMaterials).toEqual({
      status: 'available',
      data: {
        schema_version: 1,
        entries: [
          {
            material_type: '经典剧情桥段',
            source_id: 'event_1',
            relevance: '高',
            suggested_use: '主线桥段',
            reason: '具有追踪与反转结构。',
          },
        ],
      },
    });
  });

  it('preserves missing and invalid resource states instead of turning them into empty data', () => {
    expect(
      normalizeBookExtras({
        events: { status: 'missing', data: null },
        gameMaterials: { status: 'invalid', data: null, error: 'game_materials.json 数据结构无效' },
      }),
    ).toEqual({
      events: { status: 'missing', data: null },
      gameMaterials: { status: 'invalid', data: null, error: 'game_materials.json 数据结构无效' },
    });
  });

  it('marks malformed available payloads invalid rather than silently dropping records', () => {
    const result = normalizeBookExtras({
      events: { status: 'available', data: [{ id: 'event_without_name' }] },
      gameMaterials: { status: 'available', data: { schema_version: 1, entries: 'invalid' } },
    });

    expect(result.events).toMatchObject({ status: 'invalid', data: null });
    expect(result.gameMaterials).toMatchObject({ status: 'invalid', data: null });
  });
});
