import type { Character, Faction, Location, Skill, Item } from '../types/novel';

const CHINESE_TEXT_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/u;
const TECHNICAL_ID_PATTERN = /[A-Za-z_]/u;
const PREFIXED_CHINESE_NAME_PATTERN = /^(?:char|character|faction|location|loc|skill|technique|tech|item|dialogue|dlg)_([\u3400-\u9fff\uf900-\ufaff][\u3400-\u9fff\uf900-\ufaff0-9·・（）()《》—-]*)$/iu;

export function buildIdMaps(data: {
  characters: Character[];
  factions: Faction[];
  locations: Location[];
  skills: Skill[];
  items: Item[];
}) {
  const characterMap = new Map(data.characters.map((c) => [c.id, c.name]));
  const factionMap = new Map(data.factions.map((f) => [f.id, f.name]));
  const locationMap = new Map(data.locations.map((l) => [l.id, l.name]));
  const skillMap = new Map(data.skills.map((s) => [s.id, s.name]));
  const itemMap = new Map(data.items.map((i) => [i.id, i.name]));

  return { characterMap, factionMap, locationMap, skillMap, itemMap };
}

export function toChineseDisplayText(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text || !CHINESE_TEXT_PATTERN.test(text)) return null;
  const prefixedName = text.match(PREFIXED_CHINESE_NAME_PATTERN)?.[1];
  if (prefixedName) return prefixedName;
  if (TECHNICAL_ID_PATTERN.test(text)) return null;
  return text;
}

export function resolveEntityName(
  id: string | null | undefined,
  map: Map<string, string>,
): string | null {
  if (!id) return null;
  return toChineseDisplayText(map.get(id)) ?? toChineseDisplayText(id);
}

export function resolveId(
  id: string | null | undefined,
  map: Map<string, string>,
  fallback = '未注明',
): string {
  return resolveEntityName(id, map) ?? fallback;
}

export function resolveIds(
  ids: string[] | null | undefined,
  map: Map<string, string>,
): string[] {
  if (!ids) return [];
  return [...new Set(ids.flatMap((id) => {
    const name = resolveEntityName(id, map);
    return name ? [name] : [];
  }))];
}
