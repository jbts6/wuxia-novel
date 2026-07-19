import type { NovelData } from '../types/novel';

export class UnresolvedEntityError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`UNRESOLVED_ENTITY_ID: ${id}`);
    this.name = 'UnresolvedEntityError';
    this.id = id;
  }
}

const CHINESE_TEXT_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/u;
const TECHNICAL_ID_PATTERN = /[A-Za-z_]/u;

export function toChineseDisplayText(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text || !CHINESE_TEXT_PATTERN.test(text) || TECHNICAL_ID_PATTERN.test(text)) return null;
  return text;
}

function append(index: Map<string, string[]>, key: string, value: string): void {
  const values = index.get(key) ?? [];
  if (!values.includes(value)) index.set(key, [...values, value]);
}

export function buildIdMaps(data: Pick<NovelData, 'characters' | 'factions' | 'skills' | 'items'>) {
  const characterMap = new Map(data.characters.map((entry) => [entry.id, entry.name]));
  const factionMap = new Map(data.factions.map((entry) => [entry.id, entry.name]));
  const skillMap = new Map(data.skills.map((entry) => [entry.id, entry.name]));
  const itemMap = new Map(data.items.map((entry) => [entry.id, entry.name]));
  const skillUsers = new Map<string, string[]>();
  const factionMembers = new Map<string, string[]>();

  for (const character of data.characters) {
    character.skills.forEach((skillId) => append(skillUsers, skillId, character.id));
    character.factions.forEach((factionId) => append(factionMembers, factionId, character.id));
  }

  return { characterMap, factionMap, skillMap, itemMap, skillUsers, factionMembers };
}

export function resolveEntityName(
  id: string | null | undefined,
  map: Map<string, string>,
): string | null {
  if (id === null || id === undefined) return null;
  const name = map.get(id);
  if (!name) throw new UnresolvedEntityError(id);
  return name;
}

export function resolveId(id: string, map: Map<string, string>): string {
  const name = resolveEntityName(id, map);
  if (name === null) throw new UnresolvedEntityError(id);
  return name;
}

export function resolveIds(ids: string[] | null | undefined, map: Map<string, string>): string[] {
  return (ids ?? []).map((id) => resolveId(id, map));
}
