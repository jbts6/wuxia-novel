import type { Character, Skill } from '../../types/novel';
import { getSkillRank, getSkillSummary, getSkillTechniques, getSkillType } from '../../utils/skillDisplay';

export const SKILL_RANK_ORDER = [
  '返璞归真', '登峰造极', '出神入化', '炉火纯青',
  '登堂入室', '略有小成', '初窥门径', '平平无奇',
];

export interface SkillRow {
  id: string;
  name: string;
  type: string;
  rank: string;
  summary: string;
  techniqueNames: string;
  techniqueCount: number;
  holderNames: string;
  holderIds: string[];
}

export interface SkillRowFilters {
  search: string;
  types: string[];
  ranks: string[];
}

export function buildSkillRows(
  skills: Skill[],
  characters: Character[],
  filters: SkillRowFilters,
): SkillRow[] {
  const q = filters.search.toLowerCase();
  let result = skills;

  if (q) {
    result = result.filter(s =>
      s.name.toLowerCase().includes(q) ||
      getSkillSummary(s).toLowerCase().includes(q)
    );
  }
  if (filters.types.length > 0) {
    result = result.filter(s => filters.types.includes(getSkillType(s)));
  }
  if (filters.ranks.length > 0) {
    result = result.filter(s => filters.ranks.includes(getSkillRank(s)));
  }

  return [...result]
    .sort((a, b) => {
      const ai = SKILL_RANK_ORDER.indexOf(getSkillRank(a));
      const bi = SKILL_RANK_ORDER.indexOf(getSkillRank(b));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map(s => {
      const techniques = getSkillTechniques(s);
      const holders = characters.filter(c =>
        Array.isArray(c.known_skills) && c.known_skills.includes(s.id)
      );
      return {
        id: s.id,
        name: s.name,
        type: getSkillType(s),
        rank: getSkillRank(s),
        summary: getSkillSummary(s),
        techniqueNames: techniques.map(t => t.name).join('、'),
        techniqueCount: techniques.length,
        holderNames: holders.map(c => c.name).join('、'),
        holderIds: holders.map(c => c.id),
      };
    });
}
