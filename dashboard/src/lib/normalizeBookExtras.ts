import type { RawBookExtrasResponse } from '../types/library';
import {
  GAME_MATERIAL_TYPES,
  type BookExtraResource,
  type BookExtrasData,
  type Event,
  type GameMaterial,
  type GameMaterialsReport,
  type GameMaterialType,
} from '../types/novel';
import { asArray, asRecord, asString, asStringArray, isRecord, normalizeSourceRefs } from './normalizeNovelData';

function invalid<T>(error: string): BookExtraResource<T> {
  return { status: 'invalid', data: null, error };
}

function normalizeEvents(
  resource: RawBookExtrasResponse['events'],
): BookExtraResource<Event[]> {
  if (resource.status !== 'available') return resource;
  if (!resource.data.every((entry) => isRecord(entry) && asString(entry.id).trim() && asString(entry.name).trim())) {
    return invalid('events.json 响应结构无效');
  }

  return {
    status: 'available',
    data: resource.data.map((value) => {
      const record = asRecord(value);
      return {
        id: asString(record.id),
        name: asString(record.name),
        importance: asString(record.importance),
        cause: asString(record.cause),
        process: asString(record.process),
        result: asString(record.result),
        participants: asStringArray(record.participants),
        locations: asStringArray(record.locations),
        source_refs: normalizeSourceRefs(record.source_refs),
      };
    }),
  };
}

function isMaterialType(value: unknown): value is GameMaterialType {
  return typeof value === 'string' && GAME_MATERIAL_TYPES.some((entry) => entry === value);
}

function isValidMaterial(value: unknown): boolean {
  if (!isRecord(value) || !isMaterialType(value.material_type)) return false;
  return [value.source_id, value.relevance, value.suggested_use, value.reason].every(
    (entry) => typeof entry === 'string' && entry.trim().length > 0,
  );
}

function normalizeMaterial(value: unknown): GameMaterial {
  const record = asRecord(value);
  return {
    material_type: record.material_type as GameMaterialType,
    source_id: asString(record.source_id),
    relevance: asString(record.relevance),
    suggested_use: asString(record.suggested_use),
    reason: asString(record.reason),
  };
}

function normalizeGameMaterials(
  resource: RawBookExtrasResponse['gameMaterials'],
): BookExtraResource<GameMaterialsReport> {
  if (resource.status !== 'available') return resource;
  const report = asRecord(resource.data);
  const entries = asArray(report.entries);
  const hasSchemaVersion = typeof report.schema_version === 'string' || typeof report.schema_version === 'number';
  if (!hasSchemaVersion || !Array.isArray(report.entries) || !entries.every(isValidMaterial)) {
    return invalid('game_materials.json 响应结构无效');
  }

  return {
    status: 'available',
    data: {
      schema_version: report.schema_version as string | number,
      entries: entries.map(normalizeMaterial),
    },
  };
}

export function normalizeBookExtras(value: RawBookExtrasResponse): BookExtrasData {
  return {
    events: normalizeEvents(value.events),
    gameMaterials: normalizeGameMaterials(value.gameMaterials),
  };
}
