import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useNovelStore } from '../stores/useNovelStore';

export function useBookData() {
  const { authorName, bookName } = useParams<{ authorName: string; bookName: string }>();
  const { books, setCurrentBook } = useLibraryStore();
  const { loadData } = useNovelStore();

  const bookPath = authorName && bookName 
    ? `${decodeURIComponent(authorName)}/${decodeURIComponent(bookName)}`
    : null;

  useEffect(() => {
    if (bookPath) {
      setCurrentBook(bookPath);

      const book = books.find((b) => b.path === bookPath);
      if (book) {
        loadData(book.data);
      }
    }

    return () => {
      setCurrentBook(null);
    };
  }, [bookPath, books, setCurrentBook, loadData]);

  const currentBook = books.find((b) => b.path === bookPath);

  return {
    currentBook,
    bookPath,
    authorName: authorName ? decodeURIComponent(authorName) : null,
    bookName: bookName ? decodeURIComponent(bookName) : null,
  };
}
