import React from 'react';
import ItemList from '../components/items/ItemList';
import { BookChapter } from '../shared/components';

const Items: React.FC = () => (
  <BookChapter title="器 物 志" subtitle="神兵利器" seal="器" sealShape="circle">
    <ItemList />
  </BookChapter>
);

export default Items;
