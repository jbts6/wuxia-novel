import React, { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useBookStore } from '../../stores/useBookStore';

interface Crumb {
  label: string;
  to: string;
  current?: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  overview: '总 览',
  characters: '人 物 志',
  skills: '武 学 谱',
  items: '器 物 志',
  factions: '门 派 志',
  dialogues: '对 话 卷',
};

const BreadcrumbTrail: React.FC = () => {
  const params = useParams<{ author?: string; book?: string }>();
  const location = useLocation();
  const author = params.author ? decodeURIComponent(params.author) : '';
  const book = params.book ? decodeURIComponent(params.book) : '';
  const books = useBookStore(s => s.books);

  const section = useMemo(() => {
    if (!author || !book) return '';
    const base = `/${encodeURIComponent(author)}/${encodeURIComponent(book)}`;
    const rest = location.pathname.slice(base.length).replace(/^\//, '').split('/')[0];
    return rest || '';
  }, [author, book, location.pathname]);

  const crumbs = useMemo<Crumb[]>(() => {
    const list: Crumb[] = [{ label: '藏 书 阁', to: '/', current: !author }];
    if (!author) return list;

    const bookExists = books.some(
      b => b.author === author && (!book || b.name === book),
    );
    if (!bookExists && !book) {
      list.push({ label: `${author} 书斋`, to: `/${encodeURIComponent(author)}`, current: true });
      return list;
    }

    list.push({
      label: `${author} 书斋`,
      to: `/${encodeURIComponent(author)}`,
      current: !book,
    });
    if (!book) return list;

    const bookTo = `/${encodeURIComponent(author)}/${encodeURIComponent(book)}`;
    list.push({
      label: `《${book}》`,
      to: bookTo,
      current: !section,
    });

    if (section && SECTION_LABELS[section]) {
      list.push({
        label: SECTION_LABELS[section],
        to: `${bookTo}/${section}`,
        current: true,
      });
    }

    return list;
  }, [author, book, books, section]);

  if (crumbs.length <= 1 && !author) {
    return null;
  }

  return (
    <nav className="crumb-trail" aria-label="卷宗导航">
      {crumbs.map((c, i) => (
        <React.Fragment key={`${c.to}-${i}`}>
          {i > 0 && (
            <span className="crumb-sep" aria-hidden="true">
              ·
            </span>
          )}
          {c.current ? (
            <span className="crumb-item crumb-current" aria-current="page">
              {c.label}
            </span>
          ) : (
            <Link className="crumb-item" to={c.to}>
              {c.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default BreadcrumbTrail;
