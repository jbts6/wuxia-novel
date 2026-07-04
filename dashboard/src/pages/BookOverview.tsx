import React from 'react';
import Dashboard from '../components/Dashboard';
import { BookChapter } from '../shared/components';

const BookOverview: React.FC = () => (
  <BookChapter title="总 览" subtitle="卷宗精要" seal="总">
    <Dashboard />
  </BookChapter>
);

export default BookOverview;
