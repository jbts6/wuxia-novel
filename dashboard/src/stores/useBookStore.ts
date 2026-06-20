import { create } from 'zustand';

export interface BookMeta {
  path: string;
  author: string;
  name: string;
  characters: number;
  skills: number;
  factions: number;
}

interface BookStore {
  books: BookMeta[];
  currentBookPath: string | null;
  loading: boolean;
  error: string | null;

  loadBooks: () => Promise<void>;
  selectBook: (bookPath: string) => void;
}

export const useBookStore = create<BookStore>((set) => ({
  books: [],
  currentBookPath: null,
  loading: false,
  error: null,

  loadBooks: async () => {
    const staticMeta = (window as unknown as { __BOOK_META__?: BookMeta }).__BOOK_META__;
    if (staticMeta) {
      set({ books: [staticMeta], currentBookPath: staticMeta.path, loading: false });
      return;
    }
    set({ loading: true, error: null });
    try {
      const response = await fetch('/data/books.json');
      if (!response.ok) throw new Error('Failed to load books');
      const books = await response.json();
      set({ books, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载书籍列表失败', loading: false });
    }
  },

  selectBook: (bookPath: string) => {
    set({ currentBookPath: bookPath });
  },
}));
