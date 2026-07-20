'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { GameKbError } = require('./errors');
const { DATA_FILES, verifyInstalled } = require('./install');
const { atomicWriteFile, atomicWriteJson } = require('./io');
const { planLegacyMigration } = require('./legacy-migration');
const { deferredPathsFor, pathsFor } = require('./paths');
const { SEMANTIC_CONTRACT_VERSION } = require('./run');

const INSTALL_RECEIPT = 'generate_game_kb_install.json';

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function directoryEntries(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
    .sort((left, right) => compareText(left.name, right.name));
}

function isBookDirectory(directory) {
  if (!fs.existsSync(directory)) return false;
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.some(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.txt'))
    || entries.some(entry => entry.isDirectory() && ['data', '.game-kb-work'].includes(entry.name))
    || fs.existsSync(path.join(directory, 'reports', INSTALL_RECEIPT));
}

function isAuthorDirectory(directory) {
  return directoryEntries(directory).some(entry => {
    const book = path.join(directory, entry.name);
    return fs.readdirSync(book, { withFileTypes: true })
      .some(file => file.isFile() && file.name.toLowerCase().endsWith('.txt'));
  });
}

function installedDataExists(novelDir) {
  try {
    return fs.statSync(path.join(novelDir, 'data')).isDirectory();
  } catch {
    return false;
  }
}

function reasonFromError(error) {
  return {
    code: typeof error?.code === 'string' ? error.code : 'LEGACY_MIGRATION_PRECHECK_FAILED',
    message: typeof error?.message === 'string' ? error.message : String(error),
    details: error?.details && typeof error.details === 'object' ? error.details : {}
  };
}

function qualificationReasons(qualification) {
  return (qualification.blocking_errors || []).map(error => ({
    code: error.code || 'INSTALLED_VERIFICATION_FAILED',
    path: error.path || '',
    target: error.target ?? '',
    ...(error.actual_hash === undefined ? {} : { actual_hash: error.actual_hash })
  }));
}

function fileHash(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function treeFileHashes(root) {
  const files = {};
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareText(left.name, right.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files[path.relative(root, file).split(path.sep).join('/')] = fileHash(file);
    }
  };
  visit(root);
  return files;
}

function publishedRunRoot(novelDir, runId) {
  if (typeof runId !== 'string' || runId === '') return null;
  try {
    return [pathsFor(novelDir, runId).run, deferredPathsFor(novelDir, runId).run]
      .find(candidate => fs.existsSync(candidate)) || null;
  } catch {
    return null;
  }
}

function protectionHashes(novelDir, qualification) {
  const receipt = path.join(novelDir, 'reports', INSTALL_RECEIPT);
  const runRoot = publishedRunRoot(novelDir, qualification.run_id);
  if (!runRoot) {
    throw new GameKbError('QUALIFIED_RUN_MISSING', 'Qualified installation has no published run to protect', {
      novel_dir: novelDir,
      run_id: qualification.run_id
    });
  }
  return {
    data_files: Object.fromEntries(DATA_FILES.map(filename => {
      const file = path.join(novelDir, 'data', filename);
      return [filename, { path: file, hash: fileHash(file) }];
    })),
    install_receipt: { path: receipt, hash: fileHash(receipt) },
    published_run: { root: runRoot, files: treeFileHashes(runRoot) }
  };
}

function auditBook(repo, author, book) {
  const novelDir = path.join(repo, author, book);
  if (!installedDataExists(novelDir)) {
    return {
      author,
      book,
      novel_dir: novelDir,
      classification: 'not_knowledge_base',
      qualification: null,
      protection_hashes: null,
      migration: { status: 'not_applicable', plan: null, error: null },
      reasons: []
    };
  }

  const qualification = verifyInstalled(novelDir);
  if (qualification.passed) {
    return {
      author,
      book,
      novel_dir: novelDir,
      classification: 'qualified',
      qualification,
      protection_hashes: protectionHashes(novelDir, qualification),
      migration: { status: 'not_required', plan: null, error: null },
      reasons: []
    };
  }

  const reasons = qualificationReasons(qualification);
  try {
    const plan = planLegacyMigration(novelDir);
    if (plan.eligibility?.migratable !== true) {
      const migrationError = {
        code: 'MIGRATION_PLAN_INELIGIBLE',
        message: 'Legacy migration plan has blocking eligibility errors',
        details: { blocking_errors: plan.eligibility?.blocking_errors || [] }
      };
      return {
        author,
        book,
        novel_dir: novelDir,
        classification: 'unqualified',
        qualification,
        protection_hashes: null,
        migration: { status: 'non_migratable', plan, error: migrationError },
        reasons: [...reasons, ...(plan.eligibility?.blocking_errors || []), migrationError]
      };
    }
    return {
      author,
      book,
      novel_dir: novelDir,
      classification: 'unqualified',
      qualification,
      protection_hashes: null,
      migration: { status: 'migratable', plan, error: null },
      reasons
    };
  } catch (error) {
    const migrationError = reasonFromError(error);
    return {
      author,
      book,
      novel_dir: novelDir,
      classification: 'unqualified',
      qualification,
      protection_hashes: null,
      migration: { status: 'non_migratable', plan: null, error: migrationError },
      reasons: [...reasons, migrationError]
    };
  }
}

function auditRepository(repoRoot) {
  if (typeof repoRoot !== 'string' || repoRoot.trim() === '') {
    throw new GameKbError('REPOSITORY_ROOT_REQUIRED', 'Repository audit requires a repository root');
  }
  const repo = path.resolve(repoRoot);
  if (!fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) {
    throw new GameKbError('REPOSITORY_ROOT_INVALID', 'Repository root is not a directory', {
      repository_root: repo
    });
  }

  const books = [];
  for (const authorEntry of directoryEntries(repo)) {
    const authorDir = path.join(repo, authorEntry.name);
    if (!isAuthorDirectory(authorDir)) continue;
    for (const bookEntry of directoryEntries(authorDir)) {
      const novelDir = path.join(authorDir, bookEntry.name);
      if (!isBookDirectory(novelDir)) continue;
      books.push(auditBook(repo, authorEntry.name, bookEntry.name));
    }
  }
  books.sort((left, right) => compareText(`${left.author}/${left.book}`, `${right.author}/${right.book}`));

  const qualified = books.filter(row => row.classification === 'qualified').length;
  const unqualified = books.filter(row => row.classification === 'unqualified').length;
  const notKnowledgeBase = books.filter(row => row.classification === 'not_knowledge_base').length;
  const migratable = books.filter(row => row.migration.status === 'migratable').length;
  const nonMigratable = books.filter(row => row.migration.status === 'non_migratable').length;
  return {
    schema_version: 1,
    repository_root: repo,
    canonical_validator: {
      module: '.agents/skills/generate-game-kb/scripts/lib/install.js',
      function: 'verifyInstalled',
      semantic_contract_version: SEMANTIC_CONTRACT_VERSION
    },
    scan_scope: '<repository-root>/<author>/<book> directories containing source text or generated data',
    counts: {
      books: books.length,
      knowledge_bases: qualified + unqualified,
      qualified,
      unqualified,
      migratable,
      non_migratable: nonMigratable,
      not_knowledge_base: notKnowledgeBase
    },
    books
  };
}

function markdownCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll(/\r?\n/g, ' ');
}

function auditMarkdown(audit) {
  const lines = [
    '# Initial V6 Knowledge Base Audit',
    '',
    `Repository: \`${audit.repository_root}\``,
    '',
    `Canonical validator: \`${audit.canonical_validator.function}()\`, semantic contract ${audit.canonical_validator.semantic_contract_version}.`,
    '',
    `Books: ${audit.counts.books}; knowledge bases: ${audit.counts.knowledge_bases}; qualified: ${audit.counts.qualified}; unqualified: ${audit.counts.unqualified}; migratable: ${audit.counts.migratable}; non-migratable: ${audit.counts.non_migratable}.`,
    '',
    '| Author | Book | Classification | Migration | Reasons |',
    '| --- | --- | --- | --- | --- |'
  ];
  for (const row of audit.books) {
    const reasons = row.reasons.map(reason => reason.code).join(', ') || '-';
    lines.push(`| ${markdownCell(row.author)} | ${markdownCell(row.book)} | ${row.classification} | ${row.migration.status} | ${markdownCell(reasons)} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function migrationPlanDocument(audit) {
  const migrations = audit.books.filter(row => row.migration.status === 'migratable').map(row => {
    const identity = `${row.author}/${row.book}`;
    const token = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 16);
    const runId = `migration-v6-${token}`;
    const stagingRoot = path.join(audit.repository_root, '.game-kb-migration-staging', row.author, row.book);
    const flow = '.agents/skills/generate-game-kb/scripts/flow.js';
    const prefix = [
      'node', flow, 'migrate-legacy', JSON.stringify(row.novel_dir),
      '--run', runId,
      '--from', JSON.stringify(row.migration.plan.source.data_root)
    ];
    return {
      author: row.author,
      book: row.book,
      novel_dir: row.novel_dir,
      run_id: runId,
      staging_root: stagingRoot,
      dry_run_command: [...prefix, '--json'].join(' '),
      confirm_command: [
        ...prefix,
        '--staging-root', JSON.stringify(stagingRoot),
        '--confirm',
        '--json'
      ].join(' '),
      plan: row.migration.plan
    };
  });
  return {
    schema_version: 1,
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    repository_root: audit.repository_root,
    counts: { migratable: migrations.length },
    migrations
  };
}

function writeAuditReports(audit, outputDir) {
  if (!audit || !Array.isArray(audit.books)) {
    throw new GameKbError('REPOSITORY_AUDIT_INVALID', 'Audit report payload is invalid');
  }
  if (typeof outputDir !== 'string' || outputDir.trim() === '') {
    throw new GameKbError('AUDIT_OUTPUT_REQUIRED', 'Repository audit requires an output directory');
  }
  const output = path.resolve(outputDir);
  fs.mkdirSync(output, { recursive: true });
  const jsonPath = path.join(output, 'initial-audit.json');
  const markdownPath = path.join(output, 'initial-audit.md');
  const migrationPlanPath = path.join(output, 'migration-plan.json');
  atomicWriteJson(jsonPath, audit);
  atomicWriteFile(markdownPath, auditMarkdown(audit));
  atomicWriteJson(migrationPlanPath, migrationPlanDocument(audit));
  return { jsonPath, markdownPath };
}

module.exports = {
  auditRepository,
  writeAuditReports
};
