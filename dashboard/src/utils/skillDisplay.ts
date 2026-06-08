import type { Skill, Technique } from '../types/novel';

export function getSkillTechniques(skill: Skill): Technique[] {
  return Array.isArray(skill.techniques) ? skill.techniques : [];
}

export function getSkillRank(skill: Skill): string {
  return typeof skill.rank === 'string' && skill.rank ? skill.rank : '未分级';
}

export function getSkillType(skill: Skill): string {
  return typeof skill.type === 'string' && skill.type ? skill.type : '其他';
}

export function getSkillSummary(skill: Skill): string {
  if (typeof skill.one_line === 'string' && skill.one_line) return skill.one_line;
  if ('description' in skill && typeof skill.description === 'string') return skill.description;
  return '';
}
