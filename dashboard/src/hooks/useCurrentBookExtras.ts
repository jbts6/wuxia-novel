import { useLibraryStore } from '../stores/useLibraryStore';

export function useCurrentBookExtras() {
  const bookPath = useLibraryStore((state) => state.currentBook);
  const extras = useLibraryStore((state) => (bookPath ? state.extrasCache[bookPath] ?? null : null));
  const isLoading = useLibraryStore((state) => (bookPath ? state.extrasLoading[bookPath] === true : false));
  const error = useLibraryStore((state) => (bookPath ? state.extrasErrors[bookPath] ?? null : null));

  return { bookPath, extras, isLoading, error };
}
