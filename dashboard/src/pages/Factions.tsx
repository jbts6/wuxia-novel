import React from 'react';
import ForceList from '../components/factions/ForceList';
import { BookChapter } from '../shared/components';

const Factions: React.FC = () => (
  <BookChapter title="门 派 志" subtitle="江湖势力" seal="门" sealShape="tall">
    <ForceList />
  </BookChapter>
);

export default Factions;
