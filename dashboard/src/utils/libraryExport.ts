import type { AnnotatedLibraryRecord } from '../types/library';

type ExportableEntity = {
  name?: string;
  mastery_rank?: string;
  power_rank?: string;
  importance?: string;
  rarity_tier?: string;
  rank?: string;
  type?: string;
  rarity?: string;
  role?: string;
  archetype?: string;
  faction?: string | null;
};

export function serializeLibraryJson(records: AnnotatedLibraryRecord<unknown>[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: records.length,
      records,
    },
    null,
    2,
  );
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join('|') : value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeLibraryCsv(records: AnnotatedLibraryRecord<unknown>[]): string {
  const headers = [
    'key',
    'kind',
    'author',
    'bookName',
    'bookPath',
    'name',
    'mastery_rank',
    'power_rank',
    'importance',
    'rarity_tier',
    'rank',
    'rarity',
    'type',
    'role',
    'archetype',
    'faction',
    'gameTags',
    'strengthScore',
    'designNotes',
  ];

  const rows = records.map((record) => {
    const entity = record.entity as ExportableEntity;
    return [
      record.key,
      record.kind,
      record.source.author,
      record.source.bookName,
      record.source.bookPath,
      entity.name,
      entity.mastery_rank,
      entity.power_rank,
      entity.importance,
      entity.rarity_tier,
      entity.rank,
      entity.rarity,
      entity.type,
      entity.role,
      entity.archetype,
      entity.faction,
      record.annotation?.gameTags ?? [],
      record.annotation?.strengthScore ?? '',
      record.annotation?.designNotes ?? '',
    ]
      .map(csvCell)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
