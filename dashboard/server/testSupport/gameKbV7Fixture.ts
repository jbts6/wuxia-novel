import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const cjsRequire = createRequire(import.meta.url);
const libDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../.agents/skills/generate-game-kb/scripts/lib',
);
const { hashFinalData, loadData } = cjsRequire(path.join(libDir, 'verify.js')) as {
  hashFinalData: (data: Record<string, unknown[]>) => string;
  loadData: (dataRoot: string) => { data: Record<string, unknown[]>; errors: unknown[] };
};
const { hashReport } = cjsRequire(path.join(libDir, 'review-report.js')) as {
  hashReport: (report: unknown) => string;
};
const { stableHash } = cjsRequire(path.join(libDir, 'io.js')) as {
  stableHash: (value: unknown) => string;
};
const { pathsFor } = cjsRequire(path.join(libDir, 'paths.js')) as {
  pathsFor: (novelDir: string, runId: string) => { finalIdPlan: string };
};

const DATA_FILES = [
  'chapter_summaries.yaml',
  'characters.yaml',
  'factions.yaml',
  'items.yaml',
  'skills.yaml',
] as const;

const FIXTURE_DATA: Record<string, unknown[]> = {
  'characters.yaml': [{
    id: 'char_test',
    name: '测试人物',
    aliases: [],
    identities: [],
    level: '核心',
    rank: '初窥门径',
    description: '测试用角色',
    factions: ['faction_test'],
    skills: ['skill_test'],
  }],
  'skills.yaml': [{
    id: 'skill_test',
    name: '测试武功',
    aliases: [],
    types: ['内功'],
    factions: ['faction_test'],
    rank: '初窥门径',
    description: '测试用武功',
    techniques: [{ name: '入门心法', description: '基础修炼法门' }],
  }],
  'items.yaml': [{
    id: 'item_test',
    name: '测试物品',
    aliases: [],
    types: ['武器'],
    description: '测试用物品',
  }],
  'factions.yaml': [{
    id: 'faction_test',
    name: '测试门派',
    aliases: [],
    types: ['门派'],
    description: '测试用门派',
  }],
  'chapter_summaries.yaml': [{
    chapter: 1,
    title: '第一章',
    summary: '测试摘要',
  }],
};

export interface V7FixtureOptions {
  omitReceipt?: boolean;
  corruptDataFile?: string;
  omitIdPlanHash?: boolean;
  semanticContractVersion?: number;
}

function fileSha256(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

export function writeInstalledV7Fixture(
  bookDirectory: string,
  options: V7FixtureOptions = {},
): void {
  const dataDir = path.join(bookDirectory, 'data');
  const reportsDir = path.join(bookDirectory, 'reports');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });

  for (const [filename, records] of Object.entries(FIXTURE_DATA)) {
    fs.writeFileSync(path.join(dataDir, filename), yaml.dump(records), 'utf8');
  }

  const sourceContent = '测试原文内容';
  fs.writeFileSync(path.join(bookDirectory, 'source.txt'), sourceContent, 'utf8');
  const sourceHash = `sha256:${crypto.createHash('sha256').update(sourceContent).digest('hex')}`;

  const loaded = loadData(dataDir);
  const finalDataHash = hashFinalData(loaded.data);
  const dataFileHashes = Object.fromEntries(
    DATA_FILES.map((f) => [f, fileSha256(path.join(dataDir, f))]),
  );

  const reviewReport = {
    report_version: 1,
    source_hash: sourceHash,
    final_data_hash: finalDataHash,
    summary: { warning_count: 0, by_code: {}, by_category: {} },
    entries: [],
  };
  const reviewReportHash = hashReport(reviewReport);
  fs.writeFileSync(
    path.join(reportsDir, 'game-kb-review.json'),
    `${JSON.stringify(reviewReport, null, 2)}\n`,
    'utf8',
  );

  const verificationReport = {
    passed: true,
    source_hash: sourceHash,
    final_data_hash: finalDataHash,
    review_report_hash: reviewReportHash,
  };
  fs.writeFileSync(
    path.join(reportsDir, 'verification-report.json'),
    `${JSON.stringify(verificationReport, null, 2)}\n`,
    'utf8',
  );

  if (options.corruptDataFile) {
    fs.appendFileSync(path.join(dataDir, options.corruptDataFile), '\n# corrupted', 'utf8');
  }

  if (!options.omitReceipt) {
    const runId = 'test_run_001';
    const idPlan = { schema_version: 1, entities: {} };
    const idPlanPath = pathsFor(bookDirectory, runId).finalIdPlan;
    fs.mkdirSync(path.dirname(idPlanPath), { recursive: true });
    fs.writeFileSync(idPlanPath, `${JSON.stringify(idPlan, null, 2)}\n`, 'utf8');

    const receipt: Record<string, unknown> = {
      schema_version: 2,
      installer: 'generate-game-kb',
      semantic_contract_version: options.semanticContractVersion ?? 7,
      source_hash: sourceHash,
      final_data_hash: finalDataHash,
      review_report_hash: reviewReportHash,
      verification_report_hash: fileSha256(path.join(reportsDir, 'verification-report.json')),
      data_files: [...DATA_FILES],
      data_file_hashes: dataFileHashes,
      run_id: runId,
      migration_receipt_hash: null,
      chapters: [{ number: 1, title: '第一章', input_hash: sourceHash }],
    };
    if (!options.omitIdPlanHash) {
      receipt.id_plan_hash = stableHash(idPlan);
    }
    fs.writeFileSync(
      path.join(reportsDir, 'generate_game_kb_install.json'),
      JSON.stringify(receipt, null, 2),
      'utf8',
    );
  }
}
