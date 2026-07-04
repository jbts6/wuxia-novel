import React, { type ReactNode, Suspense, lazy } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Spin } from 'antd';
import ScrollLayout from './layouts/ScrollLayout';
import BookDataLayout from './layouts/BookDataLayout';

const Library = lazy(() => import('../pages/Library'));
const AuthorStudy = lazy(() => import('../pages/AuthorStudy'));
const BookLanding = lazy(() => import('../pages/BookLanding'));
const BookOverview = lazy(() => import('../pages/BookOverview'));
const Characters = lazy(() => import('../pages/Characters'));
const Skills = lazy(() => import('../pages/Skills'));
const Items = lazy(() => import('../pages/Items'));
const Factions = lazy(() => import('../pages/Factions'));
const Dialogues = lazy(() => import('../pages/Dialogues'));

const PageLoader: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '40vh',
      gap: 14,
    }}
  >
    <span className="ink-seal" style={{ width: 40, height: 40, fontSize: 20 }}>侠</span>
    <Spin />
  </div>
);

const withSuspense = (el: ReactNode) => (
  <Suspense fallback={<PageLoader />}>{el}</Suspense>
);

export interface RouteConfig {
  path?: string;
  element: React.ReactNode;
  index?: boolean;
  children?: RouteConfig[];
}

export const routes: RouteConfig[] = [
  {
    path: '/',
    element: <ScrollLayout />,
    children: [
      { index: true, element: withSuspense(<Library />) },
      { path: ':author', element: withSuspense(<AuthorStudy />) },
      {
        path: ':author/:book',
        element: <BookDataLayout />,
        children: [
          { index: true, element: withSuspense(<BookLanding />) },
          { path: 'overview', element: withSuspense(<BookOverview />) },
          { path: 'characters', element: withSuspense(<Characters />) },
          { path: 'skills', element: withSuspense(<Skills />) },
          { path: 'items', element: withSuspense(<Items />) },
          { path: 'factions', element: withSuspense(<Factions />) },
          { path: 'dialogues', element: withSuspense(<Dialogues />) },
        ],
      },
      { path: 'book/:author/:bookName', element: <LegacyBookRedirect /> },
      { path: 'book/:author/:bookName/*', element: <LegacyBookRedirect /> },
    ],
  },
];

function LegacyBookRedirect() {
  const { author, bookName, '*': rest } = useParams<{
    author: string;
    bookName: string;
    '*': string;
  }>();
  const base = `/${encodeURIComponent(author ?? '')}/${encodeURIComponent(bookName ?? '')}`;
  const target = rest ? `${base}/${rest}` : base;
  return <Navigate to={target} replace />;
}

export default routes;
