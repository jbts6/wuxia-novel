import { create } from 'zustand';

export interface BookMeta {
  path: string;
  author: string;
  name: string;
  characters: number;
}

interface BookStore {
  books: BookMeta[];
  currentBookPath: string | null;
  loading: boolean;
  error: string | null;

  loadBooks: () => Promise<void>;
  selectBook: (bookPath: string) => void;
  initFromStorage: () => void;
}

const STORAGE_KEY = 'novel-dashboard-last-book';

export const useBookStore = create<BookStore>((set, get) => ({
  books: [],
  currentBookPath: null,
  loading: false,
  error: null,

  loadBooks: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/data/books.json');
      if (!response.ok) throw new Error('Failed to load books');
      const books = await response.json();

      const { currentBookPath } = get();
      if (!currentBookPath && books.length > 0) {
        set({ books, currentBookPath: books[0].path, loading: false });
      } else {
        set({ books, loading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载书籍列表失败', loading: false });
    }
  },

  selectBook: (bookPath: string) => {
    set({ currentBookPath: bookPath, loading: true });
    try {
      localStorage.setItem(STORAGE_KEY, bookPath);
    } catch {
      // localStorage may be unavailable
    }
  },

  initFromStorage: () => {
    try {
      const lastBook = localStorage.getItem(STORAGE_KEY);
      if (lastBook) {
        set({ currentBookPath: lastBook });
      }
    } catch {
      // localStorage may be unavailable
    }
  },
}));
