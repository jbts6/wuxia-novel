import fs from 'node:fs';
import path from 'node:path';
import {
  DATA_FILE_NAMES,
  KNOWLEDGE_ENTITY_KEYS,
  SCAN_PASS_NAMES,
  type ArtifactState,
  type DataFileKey,
  type GenerationStage,
  type LibraryBookStatus,
  type LibraryStatusResponse,
  type KnowledgeEntityCounts,
  type RawNovelData,
  type ScanPassName,
  type ScanPassProgress,
  type SuggestedAction,
  type ValidationStatus,
} from '../src/types/library';

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
const PIPELINE_SCRIPT_ROOT = '.agents/skills/generate-kb/scripts';

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

function toIsoTime(milliseconds: number): string | null {
  return milliseconds > 0 ? new Date(milliseconds).toISOString() : null;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function validateNamedRecords(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((entry) => isRecord(entry) && typeof entry.id === 'string' && typeof entry.name === 'string')
  );
}

function validateDialogues(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!isRecord(entry)) return false;
      const hasText =
        typeof entry.text === 'string' ||
        typeof entry.name === 'string' ||
        (Array.isArray(entry.source_refs) &&
          entry.source_refs.some((sourceRef) => isRecord(sourceRef) && typeof sourceRef.text === 'string'));
      if (!hasText) return false;
      if (typeof entry.id === 'string' && entry.id.length > 0) return true;
      const hasSpeaker = typeof entry.speaker === 'string' || typeof entry.speaker_name === 'string';
      const hasChapter = typeof entry.chapter === 'number' || typeof entry.chapter === 'string';
      return hasSpeaker && hasChapter;
    })
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
  if (key === 'dialogues') return validateDialogues(value);
  if (key === 'chapter_summaries') return validateChapterSummaries(value);
  return validateNamedRecords(value);
}

function inspectDataDirectory(bookDirectory: string): DataInspection {
  const dataDirectory = path.join(bookDirectory, 'data');
  const missing: string[] = [];
  const errors: string[] = [];
  let present = 0;
  let valid = 0;
  const entityCounts = Object.fromEntries(KNOWLEDGE_ENTITY_KEYS.map((key) => [key, null])) as KnowledgeEntityCounts;

  for (const [key, filename] of REQUIRED_DATA_ENTRIES) {
    const target = path.join(dataDirectory, filename);
    if (!pathExists(target)) {
      missing.push(`data/${filename}`);
      continue;
    }

    present += 1;
    try {
      const value = readJson(target);
      if (validateDataFile(key, value)) {
        valid += 1;
        if (key !== 'chapter_summaries') entityCounts[key] = (value as unknown[]).length;
      } else {
        errors.push(`data/${filename} 不满足最低数据契约`);
      }
    } catch (error) {
      errors.push(`data/${filename} 无法解析：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    present,
    valid,
    entityCounts,
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

function suggestedActionFor(
  bookPath: string,
  stage: GenerationStage,
  validationStatus: ValidationStatus,
  artifacts: ArtifactState,
): SuggestedAction | null {
  const novel = shellQuote(bookPath);
  const script = (name: string) => shellQuote(`${PIPELINE_SCRIPT_ROOT}/${name}`);

  if (stage === 'not-started') {
    return {
      label: '切分章节',
      reason: '尚未发现有效的 ch_split 产物。',
      command: `node ${script('split-chapters.js')} ${novel}`,
    };
  }

  if (stage === 'prepared' && !artifacts.scanManifest) {
    return {
      label: '生成来源索引与扫描清单',
      reason: '切章已存在，但缺少可计数的 scan manifest。',
      command: `node ${script('prepare-source.js')} ${novel}`,
    };
  }

  if (stage === 'scanning' || stage === 'pending-merge') {
    return {
      label: '检查候选清单覆盖',
      reason: '继续 generate-kb 的扫描或归并阶段，并用校验脚本检查剩余窗口和 ledger。',
      command: `node ${script('validate-inventory.js')} ${novel}`,
    };
  }

  if (stage === 'pending-gap') {
    return {
      label: '检查独立查漏',
      reason: 'named-inventory 与 event-dialogue 已完成，仍需完成独立 gap audit。',
      command: `node ${script('audit-recall.js')} ${novel} --dry-run`,
    };
  }

  if (validationStatus === 'legacy-unproven') {
    return {
      label: '诊断旧版知识库',
      reason: '消费数据可浏览，但尚未经过新版 G1-G5 证明。',
      command: `node ${script('audit-recall.js')} ${novel} --legacy --dry-run`,
    };
  }

  if (validationStatus !== 'passed') {
    return {
      label: '检查质量门禁',
      reason: '数据已产出，但质量报告尚未证明 G1-G5 全部通过。',
      command: `node ${script('assess-quality.js')} ${novel} --report-only --dry-run`,
    };
  }

  return null;
}

function maxObservedMtime(bookDirectory: string): string | null {
  const targets = [
    bookDirectory,
    path.join(bookDirectory, 'ch_split'),
    path.join(bookDirectory, 'build', 'source-index.json'),
    path.join(bookDirectory, 'build', 'scan-manifest.json'),
    path.join(bookDirectory, 'build', 'candidates.jsonl'),
    path.join(bookDirectory, 'build', 'decisions.jsonl'),
    path.join(bookDirectory, 'reports', 'quality_report.json'),
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
  const errors: string[] = [];
  const buildDirectory = path.join(book.directory, 'build');
  const reportPath = path.join(book.directory, 'reports', 'quality_report.json');
  const artifacts: ArtifactState = {
    sourceText: true,
    chapterSplit: directoryHasTextFiles(path.join(book.directory, 'ch_split')),
    sourceIndex: pathExists(path.join(buildDirectory, 'source-index.json')),
    scanManifest: pathExists(path.join(buildDirectory, 'scan-manifest.json')),
    candidates: pathExists(path.join(buildDirectory, 'candidates.jsonl')),
    decisions: pathExists(path.join(buildDirectory, 'decisions.jsonl')),
    qualityReport: pathExists(reportPath),
  };
  const dataInspection = inspectDataDirectory(book.directory);
  errors.push(...dataInspection.errors);

  const manifest = parseManifest(path.join(buildDirectory, 'scan-manifest.json'), errors);
  const quality = parseQualityReport(reportPath, errors);
  const generationStage = deriveGenerationStage(artifacts, dataInspection, manifest.progress);
  const completed = dataInspection.browseable && quality.status === 'passed';

  const missingArtifacts = [...dataInspection.missing];
  if (!artifacts.chapterSplit) missingArtifacts.push('ch_split/');
  if (!artifacts.sourceIndex) missingArtifacts.push('build/source-index.json');
  if (!artifacts.scanManifest) missingArtifacts.push('build/scan-manifest.json');
  if (!artifacts.qualityReport) missingArtifacts.push('reports/quality_report.json');

  return {
    path: book.path,
    author: book.author,
    name: book.name,
    generationStage,
    validationStatus: quality.status,
    browseable: dataInspection.browseable,
    completed,
    schemaVersion: manifest.schemaVersion,
    lastUpdatedAt: maxObservedMtime(book.directory),
    scanProgress: manifest.progress,
    artifacts,
    dataCompleteness: {
      present: dataInspection.present,
      valid: dataInspection.valid,
      required: REQUIRED_DATA_ENTRIES.length,
    },
    entityCounts: dataInspection.entityCounts,
    missingArtifacts,
    errors,
    gateFailures: quality.gateFailures,
    suggestedAction: suggestedActionFor(book.path, generationStage, quality.status, artifacts),
  };
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
    result[key] = readJson(path.join(book.directory, 'data', filename)) as unknown[];
  }
  return result;
}
