import { create } from 'zustand';
import { fetchLibraryStatus, fetchRawBookData } from '../lib/libraryApi';
import { normalizeNovelData } from '../lib/normalizeNovelData';
import type { LibraryBookStatus, LibraryStatusResponse } from '../types/library';
import type { NovelData } from '../types/novel';

interface LibraryStore {
  status: LibraryStatusResponse | null;
  books: LibraryBookStatus[];
  statusLoading: boolean;
  statusError: string | null;
  currentBook: string | null;
  bookCache: Record<string, NovelData>;
  bookLoading: Record<string, boolean>;
  bookErrors: Record<string, string | null>;
  refreshStatus: () => Promise<LibraryStatusResponse>;
  ensureStatus: () => Promise<LibraryStatusResponse>;
  loadBookData: (bookPath: string) => Promise<NovelData>;
  setCurrentBook: (bookPath: string | null) => void;
}

let statusRequest: Promise<LibraryStatusResponse> | null = null;
const bookRequests = new Map<string, Promise<NovelData>>();

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  status: null,
  books: [],
  statusLoading: false,
  statusError: null,
  currentBook: null,
  bookCache: {},
  bookLoading: {},
  bookErrors: {},

  refreshStatus: async () => {
    if (statusRequest) return statusRequest;
    set({ statusLoading: true, statusError: null });
    statusRequest = fetchLibraryStatus()
      .then((status) => {
        set({ status, books: status.books, statusLoading: false });
        return status;
      })
      .catch((error: unknown) => {
        set({ statusLoading: false, statusError: messageFrom(error) });
        throw error;
      })
      .finally(() => {
        statusRequest = null;
      });
    return statusRequest;
  },

  ensureStatus: async () => get().status ?? get().refreshStatus(),

  loadBookData: async (bookPath) => {
    const cached = get().bookCache[bookPath];
    if (cached) return cached;
    const existingRequest = bookRequests.get(bookPath);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      await get().ensureStatus();
      const book = get().books.find((entry) => entry.path === bookPath);
      if (!book) throw new Error('书籍未出现在知识库目录中');
      if (!book.browseable) throw new Error('该书知识库尚不可浏览');

      set((state) => ({
        bookLoading: { ...state.bookLoading, [bookPath]: true },
        bookErrors: { ...state.bookErrors, [bookPath]: null },
      }));
      const data = normalizeNovelData(await fetchRawBookData(bookPath));
      set((state) => ({
        bookCache: { ...state.bookCache, [bookPath]: data },
        bookLoading: { ...state.bookLoading, [bookPath]: false },
      }));
      return data;
    })()
      .catch((error: unknown) => {
        set((state) => ({
          bookLoading: { ...state.bookLoading, [bookPath]: false },
          bookErrors: { ...state.bookErrors, [bookPath]: messageFrom(error) },
        }));
        throw error;
      })
      .finally(() => {
        bookRequests.delete(bookPath);
      });

    bookRequests.set(bookPath, request);
    return request;
  },

  setCurrentBook: (bookPath) => set({ currentBook: bookPath }),
}));
