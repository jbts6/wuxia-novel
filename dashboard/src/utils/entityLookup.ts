import type {
  CardType,
  Character,
  Dialogue,
  Faction,
  Item,
  Location,
  Skill,
  Technique,
} from '../types/novel';

export interface EntityCollections {
  characters: Character[];
  skills: Skill[];
  items: Item[];
  factions: Faction[];
  locations: Location[];
}

const DETAIL_TITLE_FALLBACKS: Record<CardType, string> = {
  character: '角色详情',
  skill: '技能详情',
  item: '物品详情',
  faction: '势力详情',
  location: '地点详情',
};

export function findById<T extends { id: string }>(entities: T[], id: string | null | undefined): T | undefined {
  return entities.find((entity) => entity.id === id);
}

export function findEntity(
  collections: EntityCollections,
  type: CardType,
  id: string | null | undefined,
): Character | Skill | Item | Faction | Location | undefined {
  switch (type) {
    case 'character':
      return findById(collections.characters, id);
    case 'skill':
      return findById(collections.skills, id);
    case 'item':
      return findById(collections.items, id);
    case 'faction':
      return findById(collections.factions, id);
    case 'location':
      return findById(collections.locations, id);
  }
}

export function getEntityName(
  collections: EntityCollections,
  type: CardType,
  id: string,
): string {
  return findEntity(collections, type, id)?.name ?? id;
}

export function getEntityDetailTitle(
  collections: EntityCollections,
  type: CardType | null,
  id: string | null,
): string {
  if (!type || !id) return '';

  const name = findEntity(collections, type, id)?.name;
  return name ? `${name} - ${DETAIL_TITLE_FALLBACKS[type]}` : DETAIL_TITLE_FALLBACKS[type];
}

export function getCharacterItems(items: Item[], characterId: string): Item[] {
  return items.filter((item) => item.owner === characterId);
}

export function getCharacterDialogues(
  dialogues: Dialogue[],
  characterId: string,
  characterName: string,
): Dialogue[] {
  return dialogues.filter(
    (dialogue) => dialogue.speaker === characterId || dialogue.speaker_name === characterName,
  );
}

export function getSkillTechniques(techniques: Technique[], skillId: string): Technique[] {
  return techniques.filter((technique) => technique.source_skill === skillId);
}

export function getSkillCharacters(characters: Character[], skillId: string): Character[] {
  return characters.filter(
    (character) => Array.isArray(character.known_skills) && character.known_skills.includes(skillId),
  );
}

export function getSkillItems(items: Item[], skillId: string): Item[] {
  return items.filter(
    (item) => Array.isArray(item.related_skills) && item.related_skills.includes(skillId),
  );
}

export function getItemRelatedSkills(skills: Skill[], skillIds: string[] | undefined): Skill[] {
  return skills.filter((skill) => skillIds?.includes(skill.id));
}

export function getFactionMembers(characters: Character[], factionId: string): Character[] {
  return characters.filter((character) => character.faction === factionId);
}

export function getLocationFactions(factions: Faction[], locationId: string): Faction[] {
  return factions.filter((faction) => faction.location === locationId);
}

export function getLocationCharacters(
  characters: Character[],
  factions: Faction[],
  locationId: string,
): Character[] {
  const relatedFactions = getLocationFactions(factions, locationId);
  return characters.filter(
    (character) => character.faction && relatedFactions.some((faction) => faction.id === character.faction),
  );
}
