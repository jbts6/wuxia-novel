const fs = require('fs');
const path = require('path');
const {
  normalizeSkill,
  normalizeCharacter,
  normalizeItem,
} = require('../../.agents/skills/deconstruct-novel/scripts/semantic-fields');

const ENTITY_FILES = new Map([
  ['skills.json', { key: 'skills', normalize: normalizeSkill }],
  ['characters.json', { key: 'characters', normalize: normalizeCharacter }],
  ['items.json', { key: 'items', normalize: normalizeItem }],
]);

function createReport() {
  return {
    scannedFiles: 0,
    changedFiles: 0,
    entitiesChanged: { skills: 0, characters: 0, items: 0 },
    errors: [],
    files: [],
  };
}

function stableWrite(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function migrateArrayFile(file, config, options, report) {
  report.scannedFiles += 1;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    report.errors.push({ file, message: error.message });
    return;
  }
  if (!Array.isArray(data)) return;

  let changed = false;
  const next = data.map((entity) => {
    const result = config.normalize(entity);
    if (result.changed) {
      changed = true;
      report.entitiesChanged[config.key] += 1;
    }
    return result.entity;
  });

  if (changed) {
    report.changedFiles += 1;
    report.files.push(file);
    if (!options.dryRun) stableWrite(file, next);
  }
}

function migrateRegistryFile(file, options, report) {
  report.scannedFiles += 1;
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    report.errors.push({ file, message: error.message });
    return;
  }

  let changed = false;
  const next = { ...registry };
  for (const config of ENTITY_FILES.values()) {
    const arr = registry[config.key];
    if (!Array.isArray(arr)) continue;
    next[config.key] = arr.map((entity) => {
      const result = config.normalize(entity);
      if (result.changed) {
        changed = true;
        report.entitiesChanged[config.key] += 1;
      }
      return result.entity;
    });
  }

  if (changed) {
    report.changedFiles += 1;
    report.files.push(file);
    if (!options.dryRun) stableWrite(file, next);
  }
}

function migrateBookDir(bookDir, options, report) {
  for (const [fileName, config] of ENTITY_FILES) {
    const file = path.join(bookDir, fileName);
    if (fs.existsSync(file)) migrateArrayFile(file, config, options, report);
  }

  const registry = path.join(bookDir, 'entity_registry.json');
  if (fs.existsSync(registry)) migrateRegistryFile(registry, options, report);
}

function findBookDirs(root) {
  const dirs = [];

  function walk(dir, depth) {
    if (depth > 3) return;
    const names = fs.readdirSync(dir);
    if (names.some((name) => ENTITY_FILES.has(name) || name === 'entity_registry.json')) {
      dirs.push(dir);
      return;
    }

    for (const name of names) {
      if (name.startsWith('.') || name === 'dashboard' || name === 'node_modules') continue;
      const child = path.join(dir, name);
      if (fs.existsSync(child) && fs.statSync(child).isDirectory()) walk(child, depth + 1);
    }
  }

  walk(root, 0);
  return dirs;
}

function migratePath(targetPath, options = {}) {
  const report = createReport();
  const dryRun = Boolean(options.dryRun);
  const stat = fs.statSync(targetPath);

  if (stat.isDirectory()) {
    const directFiles = fs.readdirSync(targetPath);
    if (directFiles.some((name) => ENTITY_FILES.has(name) || name === 'entity_registry.json')) {
      migrateBookDir(targetPath, { dryRun }, report);
    } else {
      findBookDirs(targetPath).forEach((dir) => migrateBookDir(dir, { dryRun }, report));
    }
  }

  return report;
}

function parseArgs(argv) {
  const options = { dryRun: false, target: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--root') {
      options.target = argv[i + 1];
      i += 1;
    } else {
      options.target = arg;
    }
  }
  return options;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const report = migratePath(path.resolve(options.target), options);
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length > 0) process.exitCode = 1;
}

module.exports = { migratePath, parseArgs };
