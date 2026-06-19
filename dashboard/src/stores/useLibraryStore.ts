import { create } from 'zustand';
import type { LibraryAnnotationMap, LibraryFilters, LibrarySection } from '../types/library';
import { createEmptyLibraryFilters } from '../utils/libraryFilters';
import { loadLibraryAnnotations, saveLibraryAnnotations, updateLibraryAnnotation } from '../utils/libraryAnnotations';

interface LibraryStore {
  section: LibrarySection;
  filters: LibraryFilters;
  selectedKey: string | null;
  annotations: LibraryAnnotationMap;
  setSection: (section: LibrarySection) => void;
  setFilters: (filters: Partial<LibraryFilters>) => void;
  resetFilters: () => void;
  selectRecord: (key: string | null) => void;
  hydrateAnnotations: () => void;
  updateAnnotation: (key: string, patch: Parameters<typeof updateLibraryAnnotation>[2]) => void;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  section: 'overview',
  filters: createEmptyLibraryFilters(),
  selectedKey: null,
  annotations: {},

  setSection: (section) => set({ section }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: createEmptyLibraryFilters() }),
  selectRecord: (selectedKey) => set({ selectedKey }),
  hydrateAnnotations: () => set({ annotations: loadLibraryAnnotations() }),
  updateAnnotation: (key, patch) => {
    const annotations = updateLibraryAnnotation(get().annotations, key, patch);
    saveLibraryAnnotations(annotations);
    set({ annotations });
  },
}));
