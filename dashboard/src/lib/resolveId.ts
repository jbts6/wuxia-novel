import type { Character, Faction, Location, Skill, Item } from '../types/novel';

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

export function resolveId(id: string | null | undefined, map: Map<string, string>): string {
  if (!id) return '-';
  return map.get(id) || id;
}
