import { describe, expect, it } from 'vitest';
import type { Skill } from '../types/novel';
import type { LibraryAnnotationMap, LibraryRecord } from '../types/library';
import {
  LIBRARY_ANNOTATIONS_STORAGE_KEY,
  annotateRecords,
  loadLibraryAnnotations,
  saveLibraryAnnotations,
  updateLibraryAnnotation,
} from './libraryAnnotations';

describe('library annotations', () => {
  it('loads an empty map when storage is empty or malformed', () => {
    expect(loadLibraryAnnotations()).toEqual({});
    localStorage.setItem(LIBRARY_ANNOTATIONS_STORAGE_KEY, '{broken');
    expect(loadLibraryAnnotations()).toEqual({});
  });

  it('saves and updates annotations by global key', () => {
    const map = updateLibraryAnnotation({}, 'skill:book:s1', {
      gameTags: ['boss-drop'],
      strengthScore: 9,
      designNotes: 'Use as late-game burst skill',
      exportEnabled: true,
    });
    saveLibraryAnnotations(map);

    expect(loadLibraryAnnotations()['skill:book:s1'].strengthScore).toBe(9);
    expect(loadLibraryAnnotations()['skill:book:s1'].gameTags).toEqual(['boss-drop']);
  });

  it('merges annotations onto records', () => {
    const records: LibraryRecord<Skill>[] = [
      {
        key: 'skill:book:s1',
        kind: 'skill',
        source: { author: '金庸', bookName: '书', bookPath: 'book' },
        entity: { id: 's1', name: '九阴真经' } as Skill,
      },
    ];
    const annotations: LibraryAnnotationMap = {
      'skill:book:s1': {
        key: 'skill:book:s1',
        gameTags: ['core'],
        updatedAt: '2026-06-19T00:00:00.000Z',
      },
    };

    expect(annotateRecords(records, annotations)[0].annotation?.gameTags).toEqual(['core']);
  });
});
