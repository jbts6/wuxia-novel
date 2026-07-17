import type { LibraryEntityKind } from '../types/library';

const VALID_KINDS = new Set<LibraryEntityKind>(['skill', 'character', 'faction', 'item']);

export interface ParsedLibraryKey {
  kind: LibraryEntityKind;
  bookPath: string;
  entityId: string;
}

function encodeBookPath(bookPath: string): string {
  return bookPath.replace(/%/g, '%25').replace(/\//g, '%2F').replace(/:/g, '%3A');
}

export function buildLibraryKey(kind: LibraryEntityKind, bookPath: string, entityId: string): string {
  return `${kind}:${encodeBookPath(bookPath)}:${entityId}`;
}

export function parseLibraryKey(key: string): ParsedLibraryKey | null {
  const parts = key.split(':');
  if (parts.length !== 3) return null;

  const [kind, encodedBookPath, entityId] = parts;
  if (!VALID_KINDS.has(kind as LibraryEntityKind)) return null;
  if (!encodedBookPath || !entityId) return null;

  return {
    kind: kind as LibraryEntityKind,
    bookPath: decodeURIComponent(encodedBookPath),
    entityId,
  };
}
