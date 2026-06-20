import type { CharacterAppearance, LibraryCharacterRecord, MergedCharacterRecord } from '../types/library';

const ROLE_PRIORITY: Record<string, number> = {
  protagonist: 0,
  companion: 1,
  villain: 2,
  npc: 3,
};

function buildAppearance(record: LibraryCharacterRecord): CharacterAppearance {
  return {
    source: record.source,
    role: record.entity.role,
    power_rank: record.entity.power_rank ?? record.entity.rank,
    importance: record.entity.importance,
    faction: record.entity.faction,
    relationships: record.entity.relationships,
    known_skills: record.entity.known_skills,
  };
}

export function mergeCharacterRecords(records: LibraryCharacterRecord[]): MergedCharacterRecord[] {
  const groups = new Map<string, LibraryCharacterRecord[]>();
  for (const record of records) {
    const id = record.entity.id;
    const group = groups.get(id);
    if (group) {
      group.push(record);
    } else {
      groups.set(id, [record]);
    }
  }

  return Array.from(groups.values()).map((group) => {
    const first = group[0].entity;
    const appearances = group.map(buildAppearance);
    const primary = [...appearances].sort(
      (a, b) => (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99),
    )[0];

    return {
      key: `character:${first.id}`,
      entityId: first.id,
      name: first.name,
      alias: first.alias,
      identity: first.identity,
      one_line: first.one_line,
      personality: first.personality,
      archetype: first.archetype,
      appearances,
      primary,
    };
  });
}
