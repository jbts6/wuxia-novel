import type { Skill, Technique } from '../types/novel';
import { RANK_COLORS } from '../theme/palette';

export function getSkillTechniques(skill: Skill): Technique[] {
  return Array.isArray(skill.techniques) ? skill.techniques : [];
}

export function getSkillRank(skill: Skill): string {
  return typeof skill.rank === 'string' && skill.rank ? skill.rank : '未分级';
}

// 武学境界 → 颜色（全站统一用调色板 RANK_COLORS，未知境界回退淡墨）
export function getRankColor(rank: string): string {
  return RANK_COLORS[rank] ?? '#9a9082';
}

export function getSkillType(skill: Skill): string {
  return typeof skill.type === 'string' && skill.type ? skill.type : '其他';
}

export function getSkillSummary(skill: Skill): string {
  if (typeof skill.one_line === 'string' && skill.one_line) return skill.one_line;
  if ('description' in skill && typeof skill.description === 'string') return skill.description;
  return '';
}

export interface ProgressionStep {
  level?: string | number;
  text: string;
}

// 数据中 progression 可能是对象数组、字符串数组，甚至单个字符串，统一归一为可渲染列表。
export function getSkillProgression(skill: Skill): ProgressionStep[] {
  const raw: unknown = skill.progression;
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => {
      if (typeof entry === 'string') {
        return entry.trim() ? [{ text: entry }] : [];
      }
      if (entry && typeof entry === 'object') {
        const obj = entry as { level?: string | number; unlock?: string };
        const text = typeof obj.unlock === 'string' ? obj.unlock : '';
        if (!text && obj.level === undefined) return [];
        return [{ level: obj.level, text }];
      }
      return [];
    });
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [{ text: raw }];
  }
  return [];
}

// effects 可能是字符串、字符串数组或 {type, description} 对象数组，统一归一为字符串列表。
export function getSkillEffects(skill: Skill): string[] {
  const raw: unknown = skill.effects;
  if (!Array.isArray(raw)) {
    return typeof raw === 'string' && raw.trim() ? [raw] : [];
  }
  return raw.flatMap((effect) => {
    if (typeof effect === 'string') return effect.trim() ? [effect] : [];
    if (effect && typeof effect === 'object') {
      const obj = effect as { type?: string; description?: string };
      const parts = [obj.type, obj.description].filter(Boolean);
      return parts.length ? [parts.join('：')] : [];
    }
    return [];
  });
}
