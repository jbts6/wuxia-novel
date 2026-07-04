import React from 'react';
import SkillTree from '../components/skills/SkillTree';
import { BookChapter } from '../shared/components';

const Skills: React.FC = () => (
  <BookChapter title="武 学 谱" subtitle="绝世神功" seal="武" sealShape="tall">
    <SkillTree />
  </BookChapter>
);

export default Skills;
