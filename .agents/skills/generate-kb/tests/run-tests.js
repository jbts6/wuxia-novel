#!/usr/bin/env node
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');
const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const TEMP_DIR = path.join(__dirname, 'temp');

// Helper to run a script and capture output
function runScript(scriptName, args = [], options = {}) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const cmd = `node "${scriptPath}" ${args.join(' ')}`;
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      cwd: options.cwd || __dirname,
      timeout: 30000,
      ...options
    });
    return { success: true, output };
  } catch (e) {
    return { success: false, output: e.stdout || '', error: e.stderr || e.message };
  }
}

// Helper to create a temp directory with test data
function setupTestDir(testName) {
  const testDir = path.join(TEMP_DIR, testName);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

// Helper to clean up temp directory
function cleanupTestDir(testName) {
  const testDir = path.join(TEMP_DIR, testName);
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// ============================================================
// Test Suite: split-chapters.js
// ============================================================
describe('split-chapters.js', () => {
  // split-chapters.js expects directory name to match novel name
  const testDir = path.join(TEMP_DIR, '天龙八部');
  
  before(() => {
    // Create directory and copy test data
    fs.mkdirSync(testDir, { recursive: true });
    const srcFile = path.join(TEST_DATA_DIR, '天龙八部.txt');
    const destFile = path.join(testDir, '天龙八部.txt');
    fs.copyFileSync(srcFile, destFile);
    
    // Create config file with seedPatterns
    const config = {
      chapterPattern: '^第[零一二三四五六七八九十百千\\d]{1,8}[回章]\\s*.*$',
      numberPattern: '^第([零一二三四五六七八九十百千\\d]{1,8})[回章]',
      seedPatterns: [
        '段誉|木婉清|钟灵',
        '无量山|大理',
        '凌波微步|北冥神功'
      ]
    };
    fs.writeFileSync(path.join(testDir, 'split-config.json'), JSON.stringify(config, null, 2));
  });
  
  after(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  it('should split chapters correctly', () => {
    const result = runScript('split-chapters.js', [testDir]);
    assert.ok(result.success, `Script failed: ${result.error}`);
    assert.ok(result.output.includes('Detected 5 chapters'), 'Should detect 5 chapters');
    
    // Check ch_split directory exists
    const splitDir = path.join(testDir, 'ch_split');
    assert.ok(fs.existsSync(splitDir), 'ch_split directory should exist');
    
    // Check chapter files
    for (let i = 1; i <= 5; i++) {
      const chFile = path.join(splitDir, `ch_${String(i).padStart(3, '0')}.txt`);
      assert.ok(fs.existsSync(chFile), `ch_${String(i).padStart(3, '0')}.txt should exist`);
    }
  });
  
  it('should generate manifest.json in build/', () => {
    const manifestPath = path.join(testDir, 'build', 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json should exist in build/');
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.totalChapters, 5);
    assert.strictEqual(manifest.novel, '天龙八部');
    assert.ok(Array.isArray(manifest.chapters));
    assert.strictEqual(manifest.chapters.length, 5);
  });
  
  it('should generate mention_index.jsonl in build/', () => {
    const jsonlPath = path.join(testDir, 'build', 'mention_index.jsonl');
    assert.ok(fs.existsSync(jsonlPath), 'mention_index.jsonl should exist in build/');
    
    const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean);
    assert.ok(lines.length > 0, 'Should have at least one mention');
    
    // Check first entry is valid JSON
    const firstEntry = JSON.parse(lines[0]);
    assert.ok(firstEntry.chapter);
    assert.ok(firstEntry.term);
  });
  
  it('should work without config file', () => {
    // Remove config file
    const configPath = path.join(testDir, 'split-config.json');
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    
    // Remove previous output
    const buildDir = path.join(testDir, 'build');
    const splitDir = path.join(testDir, 'ch_split');
    if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true });
    if (fs.existsSync(splitDir)) fs.rmSync(splitDir, { recursive: true });
    
    const result = runScript('split-chapters.js', [testDir]);
    assert.ok(result.success, `Script failed: ${result.error}`);
    assert.ok(result.output.includes('No split-config.json found'), 'Should warn about missing config');
  });
});

// ============================================================
// Test Suite: locate.js
// ============================================================
describe('locate.js', () => {
  const testDir = setupTestDir('locate');
  
  before(() => {
    // Create minimal test data
    fs.mkdirSync(path.join(testDir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'build'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'ch_split'), { recursive: true });
    
    // Create a chapter file
    fs.writeFileSync(path.join(testDir, 'ch_split', 'ch_001.txt'), 
      '段誉穿着一袭青衫，缓步走在大理无量山中。\n他生性温文尔雅，不谙世事。');
    
    // Create keywords.json for locate.js
    fs.writeFileSync(path.join(testDir, 'build', 'keywords.json'), JSON.stringify([
      '段誉', '青衫', '大理', '无量山'
    ]));
    
    // Create characters.json
    fs.writeFileSync(path.join(testDir, 'data', 'characters.json'), JSON.stringify([
      {
        id: 'char_duan_yu',
        name: '段誉',
        importance: '核心',
        source_refs: [
          { chapter: 1, anchor: '段誉 青衫' }
        ]
      }
    ]));
  });
  
  after(() => {
    cleanupTestDir('locate');
  });
  
  it('should locate entities in text', () => {
    const result = runScript('locate.js', [testDir]);
    assert.ok(result.success, `Script failed: ${result.error}`);
    
    // Check that source_refs were updated
    const chars = JSON.parse(fs.readFileSync(path.join(testDir, 'data', 'characters.json'), 'utf8'));
    const ref = chars[0].source_refs[0];
    assert.ok(ref.line_start, 'Should have line_start');
    assert.ok(ref.text, 'Should have text');
  });
});

// ============================================================
// Test Suite: verify.js
// ============================================================
describe('verify.js', () => {
  const testDir = setupTestDir('verify');
  
  before(() => {
    // Create minimal test data
    fs.mkdirSync(path.join(testDir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'ch_split'), { recursive: true });
    
    // Create a chapter file
    fs.writeFileSync(path.join(testDir, 'ch_split', 'ch_001.txt'), 
      '段誉穿着一袭青衫，缓步走在大理无量山中。');
    
    // Create characters.json with source_refs
    fs.writeFileSync(path.join(testDir, 'data', 'characters.json'), JSON.stringify([
      {
        id: 'char_duan_yu',
        name: '段誉',
        source_refs: [
          { chapter: 1, line_start: 1, line_end: 1, text: '段誉穿着一袭青衫' }
        ]
      }
    ]));
  });
  
  after(() => {
    cleanupTestDir('verify');
  });
  
  it('should verify source_refs', () => {
    const result = runScript('verify.js', [testDir]);
    assert.ok(result.success, `Script failed: ${result.error}`);
    
    // Check verification result
    const resultPath = path.join(testDir, 'verification_result.json');
    assert.ok(fs.existsSync(resultPath), 'verification_result.json should exist');
    
    const data = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    assert.ok(data.results['characters.json'], 'Should have characters.json results');
  });
});

// ============================================================
// Test Suite: assess-quality.js
// ============================================================
describe('assess-quality.js', () => {
  const testDir = setupTestDir('assess-quality');
  
  before(() => {
    // Create minimal test data
    fs.mkdirSync(path.join(testDir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'reports'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'build'), { recursive: true });
    
    // Create baseline.json
    fs.writeFileSync(path.join(testDir, 'build', 'baseline.json'), JSON.stringify({
      novel: '测试小说',
      author: '测试作者',
      characters: {
        core: [{ id: 'char_1', name: '主角', importance: '核心' }],
        important: [],
        secondary: [],
        minor: []
      },
      factions: [],
      skills: [],
      items: [],
      events: {}
    }));
    
    // Create characters.json
    fs.writeFileSync(path.join(testDir, 'data', 'characters.json'), JSON.stringify([
      { id: 'char_1', name: '主角', importance: '核心' }
    ]));
    
    // Create empty arrays for other files
    for (const file of ['factions.json', 'locations.json', 'skills.json', 'techniques.json', 'items.json', 'dialogues.json']) {
      fs.writeFileSync(path.join(testDir, 'data', file), '[]');
    }
  });
  
  after(() => {
    cleanupTestDir('assess-quality');
  });
  
  it('should assess quality and generate reports', () => {
    const result = runScript('assess-quality.js', [testDir]);
    assert.ok(result.success, `Script failed: ${result.error}`);
    assert.ok(result.output.includes('Overall Quality Score'), 'Should output quality score');
    
    // Check reports directory
    const jsonReport = path.join(testDir, 'reports', 'quality_report.json');
    const mdReport = path.join(testDir, 'reports', 'quality_report.md');
    assert.ok(fs.existsSync(jsonReport), 'quality_report.json should exist');
    assert.ok(fs.existsSync(mdReport), 'quality_report.md should exist');
  });
});

// ============================================================
// Test Suite: generate-summary.js
// ============================================================
describe('generate-summary.js', () => {
  const testDir = setupTestDir('generate-summary');
  
  before(() => {
    // Create minimal test data
    fs.mkdirSync(path.join(testDir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'reports'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'build'), { recursive: true });
    
    // Create baseline.json
    fs.writeFileSync(path.join(testDir, 'build', 'baseline.json'), JSON.stringify({
      novel: '测试小说',
      author: '测试作者'
    }));
    
    // Create quality_report.json
    fs.writeFileSync(path.join(testDir, 'reports', 'quality_report.json'), JSON.stringify({
      overall_score: 100,
      metrics: {}
    }));
    
    // Create minimal data files
    fs.writeFileSync(path.join(testDir, 'data', 'characters.json'), JSON.stringify([
      { id: 'char_1', name: '主角', importance: '核心' }
    ]));
    
    for (const file of ['factions.json', 'locations.json', 'skills.json', 'techniques.json', 'items.json', 'dialogues.json', 'chapter_summaries.json']) {
      fs.writeFileSync(path.join(testDir, 'data', file), '[]');
    }
  });
  
  after(() => {
    cleanupTestDir('generate-summary');
  });
  
  it('should generate summary.md', () => {
    const result = runScript('generate-summary.js', [testDir]);
    assert.ok(result.success, `Script failed: ${result.error}`);
    
    const summaryPath = path.join(testDir, 'summary.md');
    assert.ok(fs.existsSync(summaryPath), 'summary.md should exist');
    
    const content = fs.readFileSync(summaryPath, 'utf8');
    assert.ok(content.includes('测试小说'), 'Should include novel name');
    assert.ok(content.includes('测试作者'), 'Should include author');
  });
});

// ============================================================
// Test Suite: cross-validate.js
// ============================================================
describe('cross-validate.js', () => {
  const testDir = setupTestDir('cross-validate');
  
  before(() => {
    // Create minimal test data
    fs.mkdirSync(path.join(testDir, 'data'), { recursive: true });
    
    // Create characters with relationships
    fs.writeFileSync(path.join(testDir, 'data', 'characters.json'), JSON.stringify([
      {
        id: 'char_1',
        name: '角色1',
        relationships: [
          { target: 'char_2', type: '朋友' }
        ]
      },
      {
        id: 'char_2',
        name: '角色2',
        relationships: [
          { target: 'char_1', type: '朋友' }
        ]
      }
    ]));
    
    for (const file of ['factions.json', 'locations.json', 'skills.json', 'techniques.json', 'items.json', 'dialogues.json']) {
      fs.writeFileSync(path.join(testDir, 'data', file), '[]');
    }
  });
  
  after(() => {
    cleanupTestDir('cross-validate');
  });
  
  it('should validate cross-references', () => {
    const result = runScript('cross-validate.js', [testDir]);
    assert.ok(result.success, `Script failed: ${result.error}`);
    
    const reportPath = path.join(testDir, 'cross_validation_report.json');
    assert.ok(fs.existsSync(reportPath), 'cross_validation_report.json should exist');
  });
});

console.log('\nRunning tests...\n');
