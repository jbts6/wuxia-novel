import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useBookStore } from '../stores/useBookStore';

export function useBookRouteSync() {
  const { author, bookName } = useParams<{ author: string; bookName: string }>();
  const { books, currentBookPath, selectBook } = useBookStore();

  useEffect(() => {
    if (!author || !bookName) return;
    const decodedAuthor = decodeURIComponent(author);
    const decodedName = decodeURIComponent(bookName);
    const matched = books.find(b => b.author === decodedAuthor && b.name === decodedName);
    if (matched && matched.path !== currentBookPath) {
      selectBook(matched.path);
    }
  }, [author, bookName, books, currentBookPath, selectBook]);
}
