import type { AnnotatedLibraryRecord, LibraryAnnotation, LibraryAnnotationMap, LibraryRecord } from '../types/library';

export const LIBRARY_ANNOTATIONS_STORAGE_KEY = 'novel-dashboard-library-annotations';

export function loadLibraryAnnotations(): LibraryAnnotationMap {
  try {
    const raw = localStorage.getItem(LIBRARY_ANNOTATIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLibraryAnnotations(annotations: LibraryAnnotationMap): void {
  localStorage.setItem(LIBRARY_ANNOTATIONS_STORAGE_KEY, JSON.stringify(annotations));
}

export function updateLibraryAnnotation(
  annotations: LibraryAnnotationMap,
  key: string,
  patch: Partial<Omit<LibraryAnnotation, 'key' | 'updatedAt'>>,
): LibraryAnnotationMap {
  const previous = annotations[key] ?? { key, gameTags: [], updatedAt: new Date(0).toISOString() };
  return {
    ...annotations,
    [key]: {
      ...previous,
      ...patch,
      key,
      gameTags: patch.gameTags ?? previous.gameTags,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function annotateRecords<T>(
  records: LibraryRecord<T>[],
  annotations: LibraryAnnotationMap,
): AnnotatedLibraryRecord<T>[] {
  return records.map((record) => ({
    ...record,
    annotation: annotations[record.key] ?? null,
  }));
}
