import type {
  ChapterSummary,
  Character,
  Dialogue,
  Faction,
  Item,
  Location,
  NovelData,
  Skill,
  SourceRef,
  Technique,
} from '../types/novel';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return asOptionalString(value);
}

export function asStringArray(value: unknown): string[] {
  return asArray(value).filter((entry): entry is string => typeof entry === 'string');
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeSourceRef(value: unknown): SourceRef | null {
  const record = asRecord(value);
  const chapter = asNumber(record.chapter, Number.NaN);
  if (!Number.isFinite(chapter)) return null;

  const alternatives = asArray(record.alternatives)
    .map(normalizeSourceRef)
    .filter((entry): entry is SourceRef => entry !== null);

  return {
    chapter,
    anchor: asOptionalString(record.anchor),
    event_type: asOptionalString(record.event_type),
    line_start: record.line_start === undefined ? undefined : asNumber(record.line_start),
    line_end: record.line_end === undefined ? undefined : asNumber(record.line_end),
    text: asOptionalString(record.text),
    anchors_hit: asStringArray(record.anchors_hit),
    locate_status: asOptionalString(record.locate_status),
    locate_score: record.locate_score === undefined ? undefined : asNumber(record.locate_score),
    alternatives: alternatives.length > 0 ? alternatives : undefined,
  };
}

export function normalizeSourceRefs(value: unknown): SourceRef[] {
  return asArray(value)
    .map(normalizeSourceRef)
    .filter((entry): entry is SourceRef => entry !== null);
}

function normalizeCharacter(value: unknown): Character {
  const record = asRecord(value);
  const personality = asRecord(record.personality);
  const aliases = [...asStringArray(record.alias), ...asStringArray(record.aliases)];
  const relationships = asArray(record.relationships).flatMap((relationship) => {
    const item = asRecord(relationship);
    const target = asString(item.target);
    const type = asString(item.type);
    if (!target || !type) return [];
    return [
      {
        target,
        type,
        intensity: item.intensity === undefined ? undefined : asNumber(item.intensity),
        bond_level: item.bond_level === undefined ? undefined : asNumber(item.bond_level),
        dynamic: asString(item.dynamic),
      },
    ];
  });

  return {
    id: asString(record.id),
    name: asString(record.name),
    alias: [...new Set(aliases)],
    role: asString(record.role, '未标注'),
    archetype: asOptionalString(record.archetype),
    power_rank: asOptionalString(record.power_rank),
    faction: asNullableString(record.faction),
    identity: asOptionalString(record.identity),
    importance: asOptionalString(record.importance),
    one_line: asOptionalString(record.one_line),
    bio: asOptionalString(record.bio ?? record.biography),
    bio_source_refs: normalizeSourceRefs(record.bio_source_refs),
    aliases: asStringArray(record.aliases),
    personality: {
      traits: asStringArray(personality.traits),
      speech_style: asString(personality.speech_style),
      temperament: asOptionalString(personality.temperament),
    },
    relationships,
    skills: asStringArray(record.skills),
    items: asStringArray(record.items),
    classic_lines: asStringArray(record.classic_lines),
    source_refs: normalizeSourceRefs(record.source_refs),
  };
}

function normalizeSkill(value: unknown): Skill {
  const record = asRecord(value);
  return {
    id: asString(record.id),
    name: asString(record.name),
    type: asString(record.type, '未分类'),
    faction: asNullableString(record.faction),
    mastery_rank: asOptionalString(record.mastery_rank),
    rank: asOptionalString(record.rank),
    description: asString(record.description ?? record.one_line),
    one_line: asOptionalString(record.one_line),
    description_source_refs: normalizeSourceRefs(record.description_source_refs),
    moves: asStringArray(record.moves),
    combat_style: asStringArray(record.combat_style),
    holders: asStringArray(record.holders),
    techniques: asStringArray(record.techniques),
    source_refs: normalizeSourceRefs(record.source_refs),
  };
}

function normalizeItem(value: unknown): Item {
  const record = asRecord(value);
  const effects = asArray(record.effects).reduce<NonNullable<Item['effects']>>((result, effect) => {
    if (typeof effect === 'string') {
      result.push(effect);
      return result;
    }
    const item = asRecord(effect);
    const description = asString(item.description);
    if (description) result.push({ type: asString(item.type, 'effect'), description });
    return result;
  }, []);

  return {
    id: asString(record.id),
    name: asString(record.name),
    type: asString(record.type, '未分类'),
    rarity_tier: asOptionalString(record.rarity_tier),
    rarity: asOptionalString(record.rarity),
    tags: asStringArray(record.tags),
    importance: asOptionalString(record.importance),
    owner: asOptionalString(record.owner),
    description: asString(record.description ?? record.one_line),
    one_line: asOptionalString(record.one_line),
    description_source_refs: normalizeSourceRefs(record.description_source_refs),
    effects,
    related_skills: asStringArray(record.related_skills),
    related_characters: asStringArray(record.related_characters),
    source_refs: normalizeSourceRefs(record.source_refs),
  };
}

function normalizeFaction(value: unknown): Faction {
  const record = asRecord(value);
  return {
    id: asString(record.id),
    name: asString(record.name),
    type: asString(record.type, '未分类'),
    location: asOptionalString(record.location),
    leader: asOptionalString(record.leader),
    description: asString(record.description ?? record.one_line),
    one_line: asOptionalString(record.one_line),
    description_source_refs: normalizeSourceRefs(record.description_source_refs),
    members: asStringArray(record.members),
    sub_organizations: asStringArray(record.sub_organizations),
    sub_divisions: asStringArray(record.sub_divisions),
    source_refs: normalizeSourceRefs(record.source_refs),
  };
}

function normalizeLocation(value: unknown): Location {
  const record = asRecord(value);
  return {
    id: asString(record.id),
    name: asString(record.name),
    region: asOptionalString(record.region),
    description: asString(record.description ?? record.one_line),
    one_line: asOptionalString(record.one_line),
    description_source_refs: normalizeSourceRefs(record.description_source_refs),
    factions: asStringArray(record.factions),
    characters: asStringArray(record.characters),
    source_refs: normalizeSourceRefs(record.source_refs),
  };
}

function normalizeDialogue(value: unknown, index: number): Dialogue {
  const record = asRecord(value);
  const sourceRefs = normalizeSourceRefs(record.source_refs);
  const legacyName = asString(record.name);
  const separatorIndex = legacyName.search(/[：:]/);
  const speakerFromName = separatorIndex > 0 ? legacyName.slice(0, separatorIndex) : '';
  const textFromSource = sourceRefs.find((sourceRef) => sourceRef.text)?.text;
  const chapter = asNumber(record.chapter, sourceRefs[0]?.chapter ?? 0);
  const lineStart = record.line_start === undefined ? sourceRefs[0]?.line_start : asNumber(record.line_start);

  return {
    id: asOptionalString(record.id) ?? `dialogue-${chapter}-${lineStart ?? 'unknown'}-${index + 1}`,
    speaker: asString(record.speaker ?? record.speaker_name, speakerFromName || '未标注'),
    speaker_name: asOptionalString(record.speaker_name),
    chapter,
    line_start: lineStart,
    line_end: record.line_end === undefined ? sourceRefs[0]?.line_end : asNumber(record.line_end),
    text: asString(record.text, legacyName || textFromSource || ''),
    tone: asOptionalString(record.tone),
    context: asOptionalString(record.context),
    source_refs: sourceRefs,
  };
}

function normalizeTechnique(value: unknown): Technique {
  const record = asRecord(value);
  return {
    id: asString(record.id),
    name: asString(record.name),
    skill: asString(record.skill ?? record.source_skill),
    source_skill: asOptionalString(record.source_skill),
    type: asOptionalString(record.type),
    description: asString(record.description ?? record.one_line),
    source_refs: normalizeSourceRefs(record.source_refs),
  };
}

function normalizeChapterSummary(value: unknown): ChapterSummary {
  const record = asRecord(value);
  return {
    chapter: asNumber(record.chapter),
    title: asString(record.title, `第 ${asNumber(record.chapter)} 章`),
    summary: asString(record.summary),
    key_events: asStringArray(record.key_events),
    key_characters: asStringArray(record.key_characters ?? record.characters),
  };
}

export function normalizeNovelData(value: unknown): NovelData {
  const record = asRecord(value);
  return {
    characters: asArray(record.characters).map(normalizeCharacter),
    skills: asArray(record.skills).map(normalizeSkill),
    items: asArray(record.items).map(normalizeItem),
    factions: asArray(record.factions).map(normalizeFaction),
    locations: asArray(record.locations).map(normalizeLocation),
    dialogues: asArray(record.dialogues).map(normalizeDialogue),
    techniques: asArray(record.techniques).map(normalizeTechnique),
    chapter_summaries: asArray(record.chapter_summaries).map(normalizeChapterSummary),
  };
}
