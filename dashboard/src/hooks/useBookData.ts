import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useNovelStore } from '../stores/useNovelStore';

export function useBookData() {
  const { authorName, bookName } = useParams<{ authorName: string; bookName: string }>();
  const { status, books, statusLoading, setCurrentBook, loadBookData, bookLoading, bookErrors } = useLibraryStore();
  const { loadData, clearData } = useNovelStore();

  const decodedAuthor = authorName ? decodeURIComponent(authorName) : null;
  const decodedBook = bookName ? decodeURIComponent(bookName) : null;
  const bookPath = decodedAuthor && decodedBook ? `${decodedAuthor}/${decodedBook}` : null;

  useEffect(() => {
    if (!bookPath) return;
    let active = true;
    setCurrentBook(bookPath);
    clearData();
    void loadBookData(bookPath).then((data) => {
      if (active) loadData(data);
    }).catch(() => {
      if (active) clearData();
    });
    return () => {
      active = false;
      if (useLibraryStore.getState().currentBook === bookPath) {
        setCurrentBook(null);
      }
    };
  }, [bookPath, clearData, loadBookData, loadData, setCurrentBook]);

  return {
    currentBook: books.find((book) => book.path === bookPath) ?? null,
    bookPath,
    authorName: decodedAuthor,
    bookName: decodedBook,
    isLoading: Boolean(bookPath) && (!status || statusLoading || bookLoading[bookPath!] === true),
    error: bookPath ? bookErrors[bookPath] ?? null : null,
  };
}
