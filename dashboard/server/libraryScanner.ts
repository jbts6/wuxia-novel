import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  DATA_FILE_NAMES,
  KNOWLEDGE_ENTITY_KEYS,
  SCAN_PASS_NAMES,
  type ArtifactState,
  type DataFileKey,
  type ContentCoverage,
  type GenerationStage,
  type LibraryBookStatus,
  type LibraryStatusResponse,
  type KnowledgeEntityCounts,
  type OptionalResourceResult,
  type RawBookExtrasResponse,
  type RawNovelData,
  type ReviewReport,
  type ReviewSummary,
  type ScanPassName,
  type ScanPassProgress,
  type ValidationContract,
  type ValidationStatus,
} from '../src/types/library';
import { buildSuggestedAction } from './actionConfig';
import { getCachedStatus, setCachedStatus } from './scanCache';
import { inspectInstalledGameKb } from './gameKbValidation';
import {
  createEmptyContentCoverage,
  hasEntityContent,
  isContentEntityKey,
  summarizeContentCoverage,
} from '../src/lib/entityContent';
import { DataContractError, normalizeNovelData } from '../src/lib/normalizeNovelData';
import { GAME_MATERIAL_TYPES } from '../src/types/novel';

const EXCLUDED_ROOT_DIRECTORIES = new Set([
  '.agents',
  '.claude',
  '.codex',
  '.codegraph',
  '.git',
  '.trellis',
  'dashboard',
  'docs',
  'node_modules',
]);

const REQUIRED_DATA_ENTRIES = Object.entries(DATA_FILE_NAMES) as [DataFileKey, string][];
const REVIEW_REPORT_RELATIVE_PATH = 'reports/game-kb-review.json';
const INSTALL_RECEIPT_RELATIVE_PATH = 'reports/generate_game_kb_install.json';
const VERIFICATION_REPORT_RELATIVE_PATH = 'reports/verification-report.json';
const REVIEW_REPORT_FIELDS = ['report_version', 'source_hash', 'final_data_hash', 'summary', 'entries'] as const;
const REVIEW_SUMMARY_FIELDS = ['warning_count', 'by_code', 'by_category'] as const;
const REVIEW_ENTRY_FIELDS = [
  'code', 'severity', 'category', 'name', 'chapter_numbers',
  'source_refs', 'member_refs', 'reason', 'resolution',
] as const;

interface DiscoveredBook {
  author: string;
  name: string;
  path: string;
  directory: string;
}

interface ManifestShape {
  schema_version?: unknown;
  required_window_ids?: unknown;
  passes?: unknown;
}

interface GateShape {
  passed?: unknown;
  reasons?: unknown;
}

interface QualityReportShape {
  completion_gate_passed?: unknown;
  gates?: unknown;
}

interface DataInspection {
  present: number;
  valid: number;
  entityCounts: KnowledgeEntityCounts;
  contentCoverage: ContentCoverage;
  allFilesPresent: boolean;
  browseable: boolean;
  missing: string[];
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pathExists(target: string): boolean {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

function directoryHasTextFiles(directory: string): boolean {
  try {
    return fs.readdirSync(directory, { withFileTypes: true }).some((entry) => entry.isFile() && entry.name.endsWith('.txt'));
  } catch {
    return false;
  }
}

function readJson(target: string): unknown {
  return JSON.parse(fs.readFileSync(target, 'utf8')) as unknown;
}

function readYaml(target: string): unknown {
  return yaml.load(fs.readFileSync(target, 'utf8'));
}

function toIsoTime(milliseconds: number): string | null {
  return milliseconds > 0 ? new Date(milliseconds).toISOString() : null;
}

function validateNamedRecords(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((entry) => isRecord(entry) && typeof entry.id === 'string' && typeof entry.name === 'string')
  );
}

function validateChapterSummaries(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        (typeof entry.chapter === 'number' || typeof entry.chapter === 'string') &&
        typeof entry.summary === 'string',
    )
  );
}

function validateDataFile(key: DataFileKey, value: unknown): boolean {
  if (key === 'chapter_summaries') return validateChapterSummaries(value);
  return validateNamedRecords(value);
}

function dataFileKeyFromContractPath(contractPath: string): DataFileKey | null {
  return (Object.keys(DATA_FILE_NAMES) as DataFileKey[])
    .find((key) => contractPath === `$.${key}` || contractPath.startsWith(`$.${key}[`)) ?? null;
}

const GAME_MATERIAL_TYPE_SET = new Set<string>(GAME_MATERIAL_TYPES);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateEvents(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.every((entry) => isRecord(entry) && isNonEmptyString(entry.id) && isNonEmptyString(entry.name));
}

function validateGameMaterials(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.hasOwn(value, 'schema_version') &&
    Array.isArray(value.entries) &&
    value.entries.every(
      (entry) =>
        isRecord(entry) &&
        isNonEmptyString(entry.material_type) &&
        GAME_MATERIAL_TYPE_SET.has(entry.material_type) &&
        isNonEmptyString(entry.source_id) &&
        isNonEmptyString(entry.relevance) &&
        isNonEmptyString(entry.suggested_use) &&
        isNonEmptyString(entry.reason),
    )
  );
}

function hasExactFields(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && keys.every((key) => fields.includes(key));
}

function reviewCounts(entries: ReviewReport['entries'], field: 'code' | 'category'): Record<string, number> {
  const result = Object.create(null) as Record<string, number>;
  for (const entry of entries) result[entry[field]] = (result[entry[field]] ?? 0) + 1;
  return result;
}

function matchesReviewCounts(value: unknown, expected: Record<string, number>): boolean {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length === Object.keys(expected).length
    && entries.every(([key, count]) => Number.isInteger(count) && count === expected[key] && count > 0);
}

function parseReviewReport(value: unknown): ReviewReport {
  if (!hasExactFields(value, REVIEW_REPORT_FIELDS)) throw new Error('根节点字段无效');
  if (value.report_version !== 1) throw new Error('report_version 必须为 1');
  if (!isNonEmptyString(value.source_hash) || !isNonEmptyString(value.final_data_hash)) {
    throw new Error('source_hash/final_data_hash 无效');
  }
  if (!hasExactFields(value.summary, REVIEW_SUMMARY_FIELDS)) throw new Error('summary 字段无效');
  if (!Array.isArray(value.entries)) throw new Error('entries 必须为数组');

  const entries = value.entries.map((entry, index) => {
    if (!hasExactFields(entry, REVIEW_ENTRY_FIELDS)) throw new Error(`entries[${index}] 字段无效`);
    for (const field of ['code', 'category', 'name', 'reason', 'resolution'] as const) {
      if (!isNonEmptyString(entry[field])) throw new Error(`entries[${index}].${field} 无效`);
    }
    if (entry.severity !== 'warning') throw new Error(`entries[${index}].severity 无效`);
    if (!Array.isArray(entry.chapter_numbers)
      || entry.chapter_numbers.length === 0
      || entry.chapter_numbers.some((chapter) => !Number.isInteger(chapter))) {
      throw new Error(`entries[${index}].chapter_numbers 无效`);
    }
    if (!Array.isArray(entry.source_refs)
      || entry.source_refs.length === 0
      || entry.source_refs.some((sourceRef) => !isRecord(sourceRef))) {
      throw new Error(`entries[${index}].source_refs 无效`);
    }
    if (!Array.isArray(entry.member_refs)
      || entry.member_refs.length === 0
      || entry.member_refs.some((memberRef) => !isNonEmptyString(memberRef))) {
      throw new Error(`entries[${index}].member_refs 无效`);
    }
    return entry as unknown as ReviewReport['entries'][number];
  });

  const summary = value.summary;
  if (!Number.isInteger(summary.warning_count) || summary.warning_count !== entries.length) {
    throw new Error('summary.warning_count 无效');
  }
  if (!matchesReviewCounts(summary.by_code, reviewCounts(entries, 'code'))
    || !matchesReviewCounts(summary.by_category, reviewCounts(entries, 'category'))) {
    throw new Error('summary 分类计数无效');
  }

  return {
    report_version: 1,
    source_hash: value.source_hash,
    final_data_hash: value.final_data_hash,
    summary: {
      warning_count: summary.warning_count,
      by_code: summary.by_code as Record<string, number>,
      by_category: summary.by_category as Record<string, number>,
    },
    entries,
  };
}

function emptyReviewReport(): ReviewReport {
  return {
    report_version: 1,
    source_hash: null,
    final_data_hash: null,
    summary: { warning_count: 0, by_code: {}, by_category: {} },
    entries: [],
  };
}

function readInstallReceipt(bookDirectory: string): Record<string, unknown> | null {
  const target = path.join(bookDirectory, INSTALL_RECEIPT_RELATIVE_PATH);
  if (!pathExists(target)) return null;
  try {
    const value = readJson(target);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function inspectReviewReport(bookDirectory: string): {
  summary: ReviewSummary;
  completionReady: boolean;
  warning: string | null;
} {
  const receipt = readInstallReceipt(bookDirectory);
  const semanticV7 = receipt?.semantic_contract_version === 7;
  const target = path.join(bookDirectory, REVIEW_REPORT_RELATIVE_PATH);
  if (!pathExists(target)) {
    return {
      summary: { status: 'missing', warningCount: 0, reportPath: null },
      completionReady: !semanticV7,
      warning: semanticV7
        ? `REVIEW_REPORT_MISSING：语义合同 v7 缺少 ${REVIEW_REPORT_RELATIVE_PATH}`
        : null,
    };
  }

  let report: ReviewReport;
  try {
    report = parseReviewReport(readJson(target));
  } catch (error) {
    return {
      summary: { status: 'invalid', warningCount: 0, reportPath: REVIEW_REPORT_RELATIVE_PATH },
      completionReady: !semanticV7,
      warning: `REVIEW_REPORT_INVALID：${REVIEW_REPORT_RELATIVE_PATH} ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const sourceHash = typeof receipt?.source_hash === 'string' ? receipt.source_hash : null;
  const finalDataHash = typeof receipt?.final_data_hash === 'string' ? receipt.final_data_hash : null;
  const stale = (sourceHash !== null && report.source_hash !== sourceHash)
    || (finalDataHash !== null && report.final_data_hash !== finalDataHash);
  if (stale) {
    return {
      summary: {
        status: 'stale',
        warningCount: report.summary.warning_count,
        reportPath: REVIEW_REPORT_RELATIVE_PATH,
      },
      completionReady: !semanticV7,
      warning: `REVIEW_REPORT_STALE：${REVIEW_REPORT_RELATIVE_PATH} 与安装回执哈希不一致`,
    };
  }

  return {
    summary: {
      status: 'current',
      warningCount: report.summary.warning_count,
      reportPath: REVIEW_REPORT_RELATIVE_PATH,
    },
    completionReady: true,
    warning: null,
  };
}

function readOptionalResource<T>(
  target: string,
  label: string,
  validate: (value: unknown) => value is T,
): OptionalResourceResult<T> {
  if (!pathExists(target)) return { status: 'missing', data: null };

  try {
    const value = readJson(target);
    if (!validate(value)) return { status: 'invalid', data: null, error: `${label} 数据结构无效` };
    return { status: 'available', data: value };
  } catch {
    return { status: 'invalid', data: null, error: `${label} 无法解析` };
  }
}

function inspectDataDirectory(bookDirectory: string): DataInspection {
  const dataDirectory = path.join(bookDirectory, 'data');
  const missing: string[] = [];
  const errors: string[] = [];
  let present = 0;
  let valid = 0;
  const rawData = {} as RawNovelData;
  const entityCounts = Object.fromEntries(KNOWLEDGE_ENTITY_KEYS.map((key) => [key, null])) as KnowledgeEntityCounts;
  const contentCoverage = createEmptyContentCoverage();

  for (const [key, filename] of REQUIRED_DATA_ENTRIES) {
    const target = path.join(dataDirectory, filename);
    if (!pathExists(target)) {
      missing.push(`data/${filename}`);
      continue;
    }

    present += 1;
    try {
      const value = readYaml(target);
      if (validateDataFile(key, value)) {
        rawData[key] = value as unknown[];
        valid += 1;
        if (key !== 'chapter_summaries') entityCounts[key] = (value as unknown[]).length;
        if (isContentEntityKey(key)) {
          const records = value as unknown[];
          const detailed = records.filter((record) => hasEntityContent(key, record)).length;
          contentCoverage.byEntity[key] = {
            total: records.length,
            detailed,
            indexOnly: records.length - detailed,
          };
        }
      } else {
        errors.push(`data/${filename} 不满足最低数据契约`);
      }
    } catch (error) {
      errors.push(`data/${filename} 无法解析：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (valid === REQUIRED_DATA_ENTRIES.length) {
    try {
      normalizeNovelData(rawData);
    } catch (error) {
      const key = error instanceof DataContractError ? dataFileKeyFromContractPath(error.path) : null;
      const filename = key ? DATA_FILE_NAMES[key] : 'data';
      valid -= 1;
      if (key && isContentEntityKey(key)) {
        entityCounts[key] = null;
        contentCoverage.byEntity[key] = { total: 0, detailed: 0, indexOnly: 0 };
      }
      errors.push(`data/${filename} 不满足 V6 数据契约：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    present,
    valid,
    entityCounts,
    contentCoverage: summarizeContentCoverage(contentCoverage.byEntity),
    allFilesPresent: present === REQUIRED_DATA_ENTRIES.length,
    browseable: valid === REQUIRED_DATA_ENTRIES.length,
    missing,
    errors,
  };
}

function emptyScanProgress(): Record<ScanPassName, ScanPassProgress> {
  return {
    'named-inventory': { completed: 0, total: 0 },
    'event-dialogue': { completed: 0, total: 0 },
    'gap-audit': { completed: 0, total: 0 },
  };
}

function parseManifest(target: string, errors: string[]): {
  schemaVersion: string | null;
  progress: Record<ScanPassName, ScanPassProgress>;
} {
  const progress = emptyScanProgress();
  if (!pathExists(target)) return { schemaVersion: null, progress };

  try {
    const value = readJson(target) as ManifestShape;
    if (!isRecord(value)) throw new Error('根节点不是对象');

    const requiredIds = Array.isArray(value.required_window_ids) ? value.required_window_ids : [];
    const passes = isRecord(value.passes) ? value.passes : {};
    for (const passName of SCAN_PASS_NAMES) {
      const pass = isRecord(passes[passName]) ? passes[passName] : {};
      const completedIds = Array.isArray(pass.completed_window_ids) ? pass.completed_window_ids : [];
      progress[passName] = { completed: completedIds.length, total: requiredIds.length };
    }

    return {
      schemaVersion:
        typeof value.schema_version === 'string' || typeof value.schema_version === 'number'
          ? String(value.schema_version)
          : null,
      progress,
    };
  } catch (error) {
    errors.push(`build/scan-manifest.json 无法解析：${error instanceof Error ? error.message : String(error)}`);
    return { schemaVersion: null, progress };
  }
}

function parseQualityReport(target: string, errors: string[]): {
  status: ValidationStatus;
  gateFailures: string[];
} {
  if (!pathExists(target)) return { status: 'not-validated', gateFailures: [] };

  try {
    const value = readJson(target) as QualityReportShape;
    if (!isRecord(value)) throw new Error('根节点不是对象');
    if (typeof value.completion_gate_passed !== 'boolean' || !isRecord(value.gates)) {
      return { status: 'legacy-unproven', gateFailures: [] };
    }

    const gates = value.gates;
    const gateFailures: string[] = [];
    const hasEveryGate = ['G1', 'G2', 'G3', 'G4', 'G5'].every((gateName) => {
      const gate = gates[gateName] as GateShape | undefined;
      if (!isRecord(gate)) {
        gateFailures.push(`${gateName} 缺失`);
        return false;
      }
      if (gate.passed === true) return true;
      const reasons = Array.isArray(gate.reasons)
        ? gate.reasons.filter((reason): reason is string => typeof reason === 'string')
        : [];
      if (reasons.length === 0) {
        gateFailures.push(`${gateName} 未通过`);
        return false;
      }
      gateFailures.push(`${gateName} 未通过（${reasons.length} 项）`);
      gateFailures.push(...reasons.slice(0, 3).map((reason) => `${gateName}: ${reason}`));
      if (reasons.length > 3) {
        gateFailures.push(`${gateName} 另有 ${reasons.length - 3} 项，请查看 reports/quality_report.json`);
      }
      return false;
    });

    return {
      status: value.completion_gate_passed === true && hasEveryGate ? 'passed' : 'failed',
      gateFailures,
    };
  } catch (error) {
    errors.push(`reports/quality_report.json 无法解析：${error instanceof Error ? error.message : String(error)}`);
    return { status: 'failed', gateFailures: ['质量报告无法解析'] };
  }
}

function deriveGenerationStage(
  artifacts: ArtifactState,
  dataInspection: DataInspection,
  progress: Record<ScanPassName, ScanPassProgress>,
): GenerationStage {
  if (dataInspection.allFilesPresent) return 'data-produced';

  if (artifacts.scanManifest) {
    const namedComplete = progress['named-inventory'].total > 0 && progress['named-inventory'].completed >= progress['named-inventory'].total;
    const eventComplete = progress['event-dialogue'].total > 0 && progress['event-dialogue'].completed >= progress['event-dialogue'].total;
    const gapComplete = progress['gap-audit'].total > 0 && progress['gap-audit'].completed >= progress['gap-audit'].total;

    if (!namedComplete || !eventComplete) return 'scanning';
    if (!gapComplete) return 'pending-gap';
    return 'pending-merge';
  }

  if (artifacts.candidates || artifacts.decisions) return 'pending-merge';
  if (artifacts.chapterSplit || artifacts.sourceIndex) return 'prepared';
  return 'not-started';
}

// suggestedActionFor moved to actionConfig.ts as buildSuggestedAction

function maxObservedMtime(bookDirectory: string): string | null {
  const targets = [
    bookDirectory,
    path.join(bookDirectory, 'ch_split'),
    path.join(bookDirectory, 'build', 'source-index.json'),
    path.join(bookDirectory, 'build', 'scan-manifest.json'),
    path.join(bookDirectory, 'build', 'candidates.jsonl'),
    path.join(bookDirectory, 'build', 'decisions.jsonl'),
    path.join(bookDirectory, 'reports', 'quality_report.json'),
    path.join(bookDirectory, REVIEW_REPORT_RELATIVE_PATH),
    path.join(bookDirectory, VERIFICATION_REPORT_RELATIVE_PATH),
    path.join(bookDirectory, INSTALL_RECEIPT_RELATIVE_PATH),
    ...REQUIRED_DATA_ENTRIES.map(([, filename]) => path.join(bookDirectory, 'data', filename)),
  ];

  let latest = 0;
  for (const target of targets) {
    try {
      latest = Math.max(latest, fs.statSync(target).mtimeMs);
    } catch {
      // Missing artifacts are expected and represented elsewhere.
    }
  }
  return toIsoTime(latest);
}

export function discoverBooks(rootDirectory: string): DiscoveredBook[] {
  const books: DiscoveredBook[] = [];
  const authorEntries = fs.readdirSync(rootDirectory, { withFileTypes: true });

  for (const authorEntry of authorEntries) {
    if (!authorEntry.isDirectory() || authorEntry.name.startsWith('.') || EXCLUDED_ROOT_DIRECTORIES.has(authorEntry.name)) {
      continue;
    }

    const authorDirectory = path.join(rootDirectory, authorEntry.name);
    let bookEntries: fs.Dirent[];
    try {
      bookEntries = fs.readdirSync(authorDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const bookEntry of bookEntries) {
      if (!bookEntry.isDirectory()) continue;
      const bookDirectory = path.join(authorDirectory, bookEntry.name);
      if (!directoryHasTextFiles(bookDirectory)) continue;
      books.push({
        author: authorEntry.name,
        name: bookEntry.name,
        path: `${authorEntry.name}/${bookEntry.name}`,
        directory: bookDirectory,
      });
    }
  }

  return books.sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'));
}

function scanBook(book: DiscoveredBook): LibraryBookStatus {
  const cached = getCachedStatus(book.directory);
  if (cached) return cached;

  const errors: string[] = [];
  const buildDirectory = path.join(book.directory, 'build');
  const reportPath = path.join(book.directory, 'reports', 'quality_report.json');
  const v7Result = inspectInstalledGameKb(book.directory);

  const artifacts: ArtifactState = {
    sourceText: true,
    chapterSplit: directoryHasTextFiles(path.join(book.directory, 'ch_split')),
    sourceIndex: pathExists(path.join(buildDirectory, 'source-index.json')),
    scanManifest: pathExists(path.join(buildDirectory, 'scan-manifest.json')),
    candidates: pathExists(path.join(buildDirectory, 'candidates.jsonl')),
    decisions: pathExists(path.join(buildDirectory, 'decisions.jsonl')),
    qualityReport: pathExists(reportPath),
    v7InstallReceipt: pathExists(path.join(book.directory, INSTALL_RECEIPT_RELATIVE_PATH)),
    v7VerificationReport: pathExists(path.join(book.directory, VERIFICATION_REPORT_RELATIVE_PATH)),
    v7ReviewReport: pathExists(path.join(book.directory, REVIEW_REPORT_RELATIVE_PATH)),
  };

  const dataInspection = inspectDataDirectory(book.directory);
  errors.push(...dataInspection.errors);

  const manifest = parseManifest(path.join(buildDirectory, 'scan-manifest.json'), errors);
  const review = inspectReviewReport(book.directory);
  if (review.warning) errors.push(review.warning);

  let validationStatus: ValidationStatus;
  let validationContract: ValidationContract;
  let validationWarnings: string[];
  let validationRunId: string | null;
  let gateFailures: string[];
  let schemaVersion: string | null;
  let completed: boolean;
  const missingArtifacts = [...dataInspection.missing];

  if (v7Result) {
    const isV7 = v7Result.semanticContractVersion === 7;
    validationContract = isV7 ? 'generate-game-kb-v7' : 'generate-game-kb-legacy';
    validationStatus = v7Result.status === 'unsupported'
      ? 'legacy-unproven'
      : v7Result.status === 'passed' ? 'passed' : 'failed';
    validationWarnings = v7Result.warnings;
    validationRunId = v7Result.runId;
    gateFailures = v7Result.blockingErrors;
    schemaVersion = String(v7Result.semanticContractVersion);
    completed = isV7
      && dataInspection.browseable
      && validationStatus === 'passed'
      && review.completionReady;
    if (!artifacts.v7InstallReceipt) missingArtifacts.push(INSTALL_RECEIPT_RELATIVE_PATH);
    if (!artifacts.v7VerificationReport) missingArtifacts.push(VERIFICATION_REPORT_RELATIVE_PATH);
    if (!artifacts.v7ReviewReport) missingArtifacts.push(REVIEW_REPORT_RELATIVE_PATH);
  } else {
    const quality = parseQualityReport(reportPath, errors);
    validationContract = artifacts.qualityReport ? 'generate-kb-gates' : 'none';
    validationStatus = quality.status;
    validationWarnings = [];
    validationRunId = null;
    gateFailures = quality.gateFailures;
    schemaVersion = manifest.schemaVersion;
    completed = dataInspection.browseable
      && dataInspection.contentCoverage.state === 'complete'
      && quality.status === 'passed'
      && review.completionReady;
    if (!artifacts.chapterSplit) missingArtifacts.push('ch_split/');
    if (!artifacts.sourceIndex) missingArtifacts.push('build/source-index.json');
    if (!artifacts.scanManifest) missingArtifacts.push('build/scan-manifest.json');
    if (!artifacts.qualityReport) missingArtifacts.push('reports/quality_report.json');
  }

  const generationStage = deriveGenerationStage(artifacts, dataInspection, manifest.progress);

  const status: LibraryBookStatus = {
    path: book.path,
    author: book.author,
    name: book.name,
    generationStage,
    validationStatus,
    validationContract,
    validationWarnings,
    validationRunId,
    browseable: dataInspection.browseable,
    completed,
    schemaVersion,
    lastUpdatedAt: maxObservedMtime(book.directory),
    scanProgress: manifest.progress,
    artifacts,
    dataCompleteness: {
      present: dataInspection.present,
      valid: dataInspection.valid,
      required: REQUIRED_DATA_ENTRIES.length,
    },
    contentCoverage: dataInspection.contentCoverage,
    entityCounts: dataInspection.entityCounts,
    review: review.summary,
    missingArtifacts,
    errors,
    gateFailures,
    suggestedAction: null,
  };

  const result = { ...status, suggestedAction: buildSuggestedAction(book.path, status) };
  setCachedStatus(book.directory, result);
  return result;
}

export function scanLibrary(rootDirectory: string): LibraryStatusResponse {
  const books = discoverBooks(rootDirectory).map(scanBook);
  const inProgressStages = new Set<GenerationStage>(['prepared', 'scanning', 'pending-merge', 'pending-gap']);

  return {
    scannedAt: new Date().toISOString(),
    summary: {
      total: books.length,
      notStarted: books.filter((book) => book.generationStage === 'not-started').length,
      inProgress: books.filter((book) => inProgressStages.has(book.generationStage)).length,
      browseable: books.filter((book) => book.browseable).length,
      contentIncomplete: books.filter(
        (book) => book.browseable && (book.contentCoverage.state === 'index-only' || book.contentCoverage.state === 'partial'),
      ).length,
      completed: books.filter((book) => book.completed).length,
    },
    books,
    warnings: [],
  };
}

export function readBookData(rootDirectory: string, bookPath: string): RawNovelData {
  const book = discoverBooks(rootDirectory).find((entry) => entry.path === bookPath);
  if (!book) throw new Error('书籍不存在或路径不合法');

  const status = scanBook(book);
  if (!status.browseable) throw new Error('书籍数据不满足 Dashboard 可浏览契约');

  const result = {} as RawNovelData;
  for (const [key, filename] of REQUIRED_DATA_ENTRIES) {
    result[key] = readYaml(path.join(book.directory, 'data', filename)) as unknown[];
  }
  return result;
}

export function readReviewReport(rootDirectory: string, bookPath: string): ReviewReport {
  const book = discoverBooks(rootDirectory).find((entry) => entry.path === bookPath);
  if (!book) throw new Error('书籍不存在或路径不合法');

  const target = path.join(book.directory, REVIEW_REPORT_RELATIVE_PATH);
  if (!pathExists(target)) return emptyReviewReport();
  try {
    return parseReviewReport(readJson(target));
  } catch (error) {
    throw new Error(
      `${REVIEW_REPORT_RELATIVE_PATH} 无法解析：${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export function readBookExtras(rootDirectory: string, bookPath: string): RawBookExtrasResponse {
  const book = discoverBooks(rootDirectory).find((entry) => entry.path === bookPath);
  if (!book) throw new Error('书籍不存在或路径不合法');

  const status = scanBook(book);
  if (!status.browseable) throw new Error('书籍数据不满足 Dashboard 可浏览契约');

  return {
    events: readOptionalResource(path.join(book.directory, 'data', 'events.json'), 'events.json', validateEvents),
    gameMaterials: readOptionalResource(
      path.join(book.directory, 'reports', 'game_materials.json'),
      'game_materials.json',
      validateGameMaterials,
    ),
  };
}
