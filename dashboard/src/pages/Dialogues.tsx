import React from 'react';
import DialogueList from '../components/dialogues/DialogueList';
import { BookChapter } from '../shared/components';

const Dialogues: React.FC = () => (
  <BookChapter title="对 话 卷" subtitle="言语之间" seal="语" sealShape="circle">
    <DialogueList />
  </BookChapter>
);

export default Dialogues;
