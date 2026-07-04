import React from 'react';
import CharacterList from '../components/characters/CharacterList';
import CharacterMindMap from '../components/mindmap/CharacterMindMap';
import { BookChapter } from '../shared/components';

const Characters: React.FC = () => (
  <BookChapter title="人 物 志" subtitle="芸芸众生" seal="人" sealShape="circle">
    <CharacterMindMap />
    <div style={{ marginTop: 32 }}>
      <CharacterList />
    </div>
  </BookChapter>
);

export default Characters;
