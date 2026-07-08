import { create } from 'zustand';
import type { BookMeta } from '../types/novel';
import { books } from '../data/books';

interface LibraryStore {
  books: BookMeta[];
  currentBook: string | null;
  setCurrentBook: (path: string | null) => void;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  books,
  currentBook: null,
  setCurrentBook: (path) => set({ currentBook: path }),
}));
