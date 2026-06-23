import { describe, expect, it } from 'vitest';
import type {
  Character,
  Dialogue,
  Faction,
  Item,
  Location,
  Skill,
  Technique,
} from '../types/novel';
import {
  getCharacterDialogues,
  getCharacterItems,
  getEntityDetailTitle,
  getEntityName,
  getFactionMembers,
  getItemRelatedSkills,
  getLocationCharacters,
  getLocationFactions,
  getSkillCharacters,
  getSkillItems,
  getSkillTechniques,
} from './entityLookup';

const characters = [
  {
    id: 'char_li',
    name: '李寻欢',
    identity: '探花',
    faction: 'faction_li',
    known_skills: ['skill_dagger'],
  },
  {
    id: 'char_afei',
    name: '阿飞',
    identity: '剑客',
    faction: 'faction_border',
    known_skills: [],
  },
] as Character[];

const skills = [
  { id: 'skill_dagger', name: '小李飞刀', one_line: '例不虚发' },
  { id: 'skill_sword', name: '快剑', one_line: '出剑极快' },
] as Skill[];

const items = [
  {
    id: 'item_dagger',
    name: '飞刀',
    owner: 'char_li',
    related_skills: ['skill_dagger'],
    one_line: '薄刃',
  },
  {
    id: 'item_sword',
    name: '铁剑',
    owner: 'char_afei',
    related_skills: ['skill_sword'],
    one_line: '无鞘',
  },
] as Item[];

const factions = [
  { id: 'faction_li', name: '李园', location: 'loc_capital', type: '宅院' },
  { id: 'faction_border', name: '边城', location: 'loc_border', type: '江湖' },
] as Faction[];

const locations = [
  { id: 'loc_capital', name: '京城', region: '中原' },
  { id: 'loc_border', name: '边关', region: '塞外' },
] as Location[];

const dialogues = [
  { speaker: 'char_li', speaker_name: '李寻欢', text: '该出手时便出手', tone: '平静', chapter: 1 },
  { speaker: 'unknown', speaker_name: '李寻欢', text: '人情难还', tone: '苦笑', chapter: 2 },
  { speaker: 'char_afei', speaker_name: '阿飞', text: '我只信剑', tone: '冷淡', chapter: 3 },
] as Dialogue[];

const techniques = [
  { id: 'tech_throw', name: '飞刀一击', type: 'attack', description: '极快', source_skill: 'skill_dagger' },
  { id: 'tech_sword', name: '快剑一式', type: 'attack', description: '极准', source_skill: 'skill_sword' },
] as Technique[];

const collections = {
  characters,
  skills,
  items,
  factions,
  locations,
};

describe('entity lookup helpers', () => {
  it('resolves entity names and detail titles by type with the same fallbacks as the detail panel', () => {
    expect(getEntityName(collections, 'character', 'char_li')).toBe('李寻欢');
    expect(getEntityName(collections, 'skill', 'skill_dagger')).toBe('小李飞刀');
    expect(getEntityName(collections, 'item', 'missing_item')).toBe('missing_item');
    expect(getEntityDetailTitle(collections, 'character', 'char_li')).toBe('李寻欢 - 角色详情');
    expect(getEntityDetailTitle(collections, 'character', 'missing_char')).toBe('角色详情');
    expect(getEntityDetailTitle(collections, null, null)).toBe('');
  });

  it('finds character relationship entities used by character cards', () => {
    expect(getCharacterItems(items, 'char_li').map((item) => item.id)).toEqual(['item_dagger']);
    expect(getCharacterDialogues(dialogues, 'char_li', '李寻欢').map((dialogue) => dialogue.text)).toEqual([
      '该出手时便出手',
      '人情难还',
    ]);
  });

  it('finds skill relationship entities used by skill and item cards', () => {
    expect(getSkillTechniques(techniques, 'skill_dagger').map((technique) => technique.id)).toEqual(['tech_throw']);
    expect(getSkillCharacters(characters, 'skill_dagger').map((character) => character.id)).toEqual(['char_li']);
    expect(getSkillItems(items, 'skill_dagger').map((item) => item.id)).toEqual(['item_dagger']);
    expect(getItemRelatedSkills(skills, ['skill_dagger']).map((skill) => skill.id)).toEqual(['skill_dagger']);
  });

  it('finds faction and location relationship entities used by location and faction cards', () => {
    expect(getFactionMembers(characters, 'faction_li').map((character) => character.id)).toEqual(['char_li']);
    expect(getLocationFactions(factions, 'loc_capital').map((faction) => faction.id)).toEqual(['faction_li']);
    expect(getLocationCharacters(characters, factions, 'loc_capital').map((character) => character.id)).toEqual([
      'char_li',
    ]);
  });
});
