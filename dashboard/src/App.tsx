import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TooltipProvider } from './components/ui/tooltip';
import { AppLayout } from './components/layout/AppLayout';
import Library from './pages/Library';
import BrowseLibrary from './pages/BrowseLibrary';
import AuthorBooks from './pages/AuthorBooks';
import BookOverview from './pages/BookOverview';
import Characters from './pages/Characters';
import Skills from './pages/Skills';
import Items from './pages/Items';
import Factions from './pages/Factions';
import ChapterSummaries from './pages/ChapterSummaries';
import ReviewPage from './pages/ReviewPage';

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/browse" element={<BrowseLibrary />} />
          <Route path="/:authorName" element={<AuthorBooks />} />
          <Route path="/:authorName/:bookName" element={<AppLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<BookOverview />} />
            <Route path="characters" element={<Characters />} />
            <Route path="skills" element={<Skills />} />
            <Route path="items" element={<Items />} />
            <Route path="factions" element={<Factions />} />
            <Route path="chapter-summaries" element={<ChapterSummaries />} />
            <Route path="review" element={<ReviewPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}
