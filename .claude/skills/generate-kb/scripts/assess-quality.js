#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: assess-quality.js <novelDir>');
  console.error('  Requires baseline.json in the novel directory');
  process.exit(1);
}

const novelDir = path.resolve(args[0]);

// Directory structure
const dataDir = path.join(novelDir, 'data');
const reportsDir = path.join(novelDir, 'reports');
const buildDir = path.join(novelDir, 'build');

// Load JSON file helper with subdirectory support
function loadJson(filename, subdir) {
  // Try subdir first, then root
  const dirs = subdir ? [path.join(novelDir, subdir), novelDir] : [novelDir];
  for (const dir of dirs) {
    const fp = path.join(dir, filename);
    if (fs.existsSync(fp)) {
      try {
        return JSON.parse(fs.readFileSync(fp, 'utf8'));
      } catch (e) {
        console.error(`Error parsing ${filename}: ${e.message}`);
        return null;
      }
    }
  }
  return null;
}

// Load knowledge base files (from data/)
const characters = loadJson('characters.json', 'data') || [];
const factions = loadJson('factions.json', 'data') || [];
const locations = loadJson('locations.json', 'data') || [];
const skills = loadJson('skills.json', 'data') || [];
const techniques = loadJson('techniques.json', 'data') || [];
const items = loadJson('items.json', 'data') || [];
const dialogues = loadJson('dialogues.json', 'data') || [];
const chapterSummaries = loadJson('chapter_summaries.json', 'data') || [];

// Load baseline (from build/)
const baseline = loadJson('baseline.json', 'build');
if (!baseline) {
  console.error('baseline.json not found. Run generate-baseline-prompt.js first.');
  process.exit(1);
}

console.log('=== Quality Assessment ===\n');
console.log(`Novel: ${baseline.novel || 'Unknown'}`);
console.log(`Author: ${baseline.author || 'Unknown'}`);

// ============================================================
// Build lookup maps
// ============================================================
const charById = new Map(characters.map(c => [c.id, c]));
const charByName = new Map(characters.map(c => [c.name, c]));
const factionById = new Map(factions.map(f => [f.id, f]));
const skillById = new Map(skills.map(s => [s.id, s]));
const skillByName = new Map(skills.map(s => [s.name, s]));
const itemById = new Map(items.map(i => [i.id, i]));
const itemByName = new Map(items.map(i => [i.name, i]));

// ============================================================
// Helper functions
// ============================================================
function importanceLabel(level) {
  const map = { core: '核心', important: '重要', secondary: '次要', minor: '龙套', background: '背景' };
  return map[level] || level;
}

function hasCommonKeywords(str1, str2, minCommon = 2) {
  const keywords1 = new Set((str1 || '').match(/[\u4e00-\u9fa5]{2,}/g) || []);
  const keywords2 = new Set((str2 || '').match(/[\u4e00-\u9fa5]{2,}/g) || []);
  let common = 0;
  for (const k of keywords1) {
    if (keywords2.has(k)) common++;
  }
  return common >= minCommon;
}

// ============================================================
// 1. Entity Completeness
// ============================================================
function assessEntityCompleteness() {
  const baselineChars = baseline.characters || {};
  const details = {};
  const missing = [];

  for (const importance of ['core', 'important', 'secondary', 'minor']) {
    const expected = baselineChars[importance] || [];
    let matched = 0;

    for (const exp of expected) {
      // Check by ID or name
      if (charById.has(exp.id) || charByName.has(exp.name)) {
        matched++;
      } else {
        missing.push({
          id: exp.id,
          name: exp.name,
          importance: importanceLabel(importance),
          reason: exp.reason || 'Expected by baseline'
        });
      }
    }

    details[importance] = {
      expected: expected.length,
      actual: matched,
      coverage: expected.length > 0 ? Math.round((matched / expected.length) * 1000) / 10 : 100
    };
  }

  const totalExpected = Object.values(details).reduce((s, d) => s + d.expected, 0);
  const totalActual = Object.values(details).reduce((s, d) => s + d.actual, 0);
  const score = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 1000) / 10 : 100;

  return { score, details, missing };
}

// ============================================================
// 2. Relationship Completeness & Accuracy
// ============================================================
function assessRelationships() {
  const baselineRels = baseline.relationships || [];
  const details = { core: { expected: 0, actual: 0 }, important: { expected: 0, actual: 0 }, secondary: { expected: 0, actual: 0 } };
  const missing = [];
  const incorrect = [];

  // Build actual relationship set: "source->target" -> type
  const actualRelMap = new Map(); // "source->target" -> Set of types
  for (const c of characters) {
    if (!Array.isArray(c.relationships)) continue;
    for (const rel of c.relationships) {
      const key = `${c.id}->${rel.target}`;
      if (!actualRelMap.has(key)) actualRelMap.set(key, new Set());
      actualRelMap.get(key).add(rel.type);
    }
  }

  // Check each baseline relationship
  for (const rel of baselineRels) {
    const importance = rel.importance || 'secondary';
    if (!details[importance]) continue;

    details[importance].expected++;

    // Support both source/target and char1/char2 formats
    const source = rel.source || rel.char1;
    const target = rel.target || rel.char2;

    const key = `${source}->${target}`;
    const reverseKey = `${target}->${source}`;
    const actualTypes = actualRelMap.get(key) || actualRelMap.get(reverseKey) || new Set();

    if (actualTypes.size > 0) {
      details[importance].actual++;
      // Check if type matches
      if (!actualTypes.has(rel.type)) {
        incorrect.push({
          source,
          target,
          expected: rel.type,
          actual: [...actualTypes][0],
          importance: importanceLabel(importance)
        });
      }
    } else {
      missing.push(rel);
    }
  }

  const totalExpected = Object.values(details).reduce((s, d) => s + d.expected, 0);
  const totalActual = Object.values(details).reduce((s, d) => s + d.actual, 0);
  const completeness = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 1000) / 10 : 100;

  const totalChecked = totalActual;
  const correctCount = totalChecked - incorrect.length;
  const accuracy = totalChecked > 0 ? Math.round((correctCount / totalChecked) * 1000) / 10 : 100;

  return { completeness, accuracy, details, missing, incorrect };
}

// ============================================================
// 3. Description Accuracy
// ============================================================
function assessDescriptionAccuracy() {
  const baselineChars = baseline.characters || {};
  const issues = [];
  let totalChecked = 0;
  let accurate = 0;

  // Helper: extract Chinese concepts from text
  function extractConcepts(text) {
    const concepts = new Set();
    // Split by common particles and extract meaningful phrases
    const parts = text.split(/[，。、；：！？""''（）【】\s之其的与和为是]+/);
    for (const part of parts) {
      if (part.length >= 2) {
        concepts.add(part);
      }
    }
    return concepts;
  }

  // Helper: check if two identity strings are semantically similar
  function identityMatch(expected, actual) {
    if (!expected || !actual) return true; // No data to compare
    // Exact match
    if (actual.includes(expected) || expected.includes(actual)) return true;
    // Extract key concepts and check overlap
    const expectedConcepts = extractConcepts(expected);
    const actualConcepts = extractConcepts(actual);
    let overlap = 0;
    for (const c of expectedConcepts) {
      if (actualConcepts.has(c)) overlap++;
    }
    // If at least 1 concept overlaps, consider it a match (very lenient)
    return overlap >= 1;
  }

  // Helper: check if traits are semantically similar
  function traitsMatch(expected, actual) {
    if (!expected || !actual || expected.length === 0) return true;
    let matched = 0;
    for (const et of expected) {
      if (actual.some(at => 
        at.includes(et) || et.includes(at) || 
        hasCommonKeywords(at, et, 1)
      )) {
        matched++;
      }
    }
    // If at least 1 trait matches, consider it a match (very lenient)
    return matched >= 1;
  }

  // Check core and important characters
  for (const importance of ['core', 'important']) {
    const expected = baselineChars[importance] || [];
    for (const exp of expected) {
      const actual = charById.get(exp.id) || charByName.get(exp.name);
      if (!actual) continue;

      totalChecked++;
      let charAccurate = true;

      // Check identity
      if (exp.expected_identity && actual.identity) {
        if (!identityMatch(exp.expected_identity, actual.identity)) {
          charAccurate = false;
          issues.push({
            id: exp.id,
            name: exp.name,
            field: 'identity',
            expected: exp.expected_identity,
            actual: actual.identity,
            reason: 'Identity mismatch'
          });
        }
      }

      // Check personality traits
      if (exp.expected_traits && actual.personality?.traits) {
        if (!traitsMatch(exp.expected_traits, actual.personality.traits)) {
          charAccurate = false;
          const missingTraits = exp.expected_traits.filter(t => 
            !actual.personality.traits.some(at => at.includes(t) || t.includes(at))
          );
          issues.push({
            id: exp.id,
            name: exp.name,
            field: 'personality.traits',
            expected: exp.expected_traits,
            actual: actual.personality.traits,
            reason: `Missing traits: ${missingTraits.join(', ')}`
          });
        }
      }

      if (charAccurate) accurate++;
    }
  }

  const score = totalChecked > 0 ? Math.round((accurate / totalChecked) * 1000) / 10 : 100;
  return { score, totalChecked, accurate, issues };
}

// ============================================================
// 4. Event Coverage
// ============================================================
function assessEventCoverage() {
  const baselineEvents = baseline.events || {};
  const details = { main: { expected: 0, actual: 0 }, branch: { expected: 0, actual: 0 }, detail: { expected: 0, actual: 0 } };
  const missing = [];

  // Build chapter summaries lookup
  const chapterEvents = new Map();
  for (const cs of chapterSummaries) {
    if (cs.chapter && Array.isArray(cs.key_events)) {
      chapterEvents.set(cs.chapter, cs.key_events);
    }
  }

  for (const [chapter, chapterData] of Object.entries(baselineEvents)) {
    // Use chapterData.chapter if available, otherwise parse the key
    const chNum = chapterData.chapter || parseInt(chapter, 10);
    const actualEvents = chapterEvents.get(chNum) || [];

    // Handle both formats: array of events or object with events array
    const events = Array.isArray(chapterData) ? chapterData : (chapterData.events || []);
    const chapterTitle = chapterData.title || '';

    for (const event of events) {
      // Handle both string events and object events
      const eventStr = typeof event === 'string' ? event : (event.event || event.name || '');
      const importance = (typeof event === 'object' ? event.importance : null) || 'detail';
      if (!details[importance]) continue;

      details[importance].expected++;

      // Check if any actual event matches
      const found = actualEvents.some(ae => 
        ae.includes(eventStr) || 
        eventStr.includes(ae) ||
        hasCommonKeywords(ae, eventStr, 2)
      );

      if (found) {
        details[importance].actual++;
      } else {
        missing.push({ chapter: chNum, event: eventStr, importance });
      }
    }
  }

  const totalExpected = Object.values(details).reduce((s, d) => s + d.expected, 0);
  const totalActual = Object.values(details).reduce((s, d) => s + d.actual, 0);
  const score = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 1000) / 10 : 100;

  return { score, details, missing };
}

// ============================================================
// 5. Dialogue Quality
// ============================================================
function assessDialogueQuality() {
  const baselineDialogues = baseline.dialogues || [];
  let baselineChecked = 0;
  let baselineMatched = 0;
  let characterFit = 0;
  const issues = [];

  // Basic stats
  const totalDialogues = dialogues.length;
  const dialoguesWithSpeaker = dialogues.filter(d => d.speaker).length;
  const dialoguesWithListener = dialogues.filter(d => d.listener).length;

  // Check against baseline expectations
  for (const exp of baselineDialogues) {
    baselineChecked++;
    
    // Find matching dialogue by chapter and speaker
    const actual = dialogues.find(d => 
      d.chapter === exp.chapter && 
      (d.speaker_name === exp.speaker || d.speaker === exp.speaker)
    );
    
    if (actual) {
      baselineMatched++;
      
      // Check character fit
      const char = charById.get(actual.speaker);
      if (char && exp.expected_style) {
        const speechStyle = char.personality?.speech_style || '';
        if (speechStyle.includes(exp.expected_style) || exp.expected_style.includes(speechStyle)) {
          characterFit++;
        } else {
          issues.push({
            index: dialogues.indexOf(actual),
            chapter: actual.chapter,
            speaker: actual.speaker_name,
            issue: `Speech style mismatch: expected "${exp.expected_style}", got "${speechStyle}"`
          });
        }
      } else {
        characterFit++; // No style to check, count as fit
      }
    }
  }

  const authenticity = baselineChecked > 0 ? Math.round((baselineMatched / baselineChecked) * 1000) / 10 : 100;
  const representativeness = totalDialogues > 0 ? Math.round((dialoguesWithSpeaker / totalDialogues) * 1000) / 10 : 100;
  const characterFitScore = baselineChecked > 0 ? Math.round((characterFit / baselineChecked) * 1000) / 10 : 100;

  return {
    authenticity,
    representativeness,
    characterFit: characterFitScore,
    details: {
      total: totalDialogues,
      withSpeaker: dialoguesWithSpeaker,
      withListener: dialoguesWithListener,
      baselineChecked,
      baselineMatched
    },
    issues
  };
}

// ============================================================
// 6. Cross-Book Purity (Enhanced)
// ============================================================

// Name variant matching helper
function normalizeName(name) {
  // Remove common suffixes/prefixes for matching
  return name
    .replace(/派$|教$|帮$|门$|山庄$|谷$/, '')
    .replace(/法$|功$|术$|剑$|掌$|拳$/, '')
    .replace(/秘籍$|秘笈$/, '')
    .replace(/神掌$/, '')
    .replace(/剑法$/, '剑')
    .replace(/掌法$/, '掌');
}

function namesMatch(name1, name2) {
  // Exact match
  if (name1 === name2) return true;
  // Check if one contains the other
  if (name1.includes(name2) || name2.includes(name1)) return true;
  // Normalized match
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  return false;
}

function assessCrossBookPurity() {
  const baselineChars = baseline.characters || {};
  const baselineSkills = baseline.skills || [];
  const baselineItems = baseline.items || [];
  const baselineFactions = baseline.factions || [];
  const knownEntityNames = new Set();
  const knownEntityNamesNormalized = new Set();

  // Collect all baseline entity names (with variants)
  for (const importance of ['core', 'important', 'secondary', 'minor']) {
    for (const entity of (baselineChars[importance] || [])) {
      knownEntityNames.add(entity.name);
      knownEntityNamesNormalized.add(normalizeName(entity.name));
      // Add aliases if present
      if (entity.alias) {
        for (const a of (Array.isArray(entity.alias) ? entity.alias : [entity.alias])) {
          knownEntityNames.add(a);
          knownEntityNamesNormalized.add(normalizeName(a));
        }
      }
    }
  }
  for (const skill of baselineSkills) {
    knownEntityNames.add(skill.name);
    knownEntityNamesNormalized.add(normalizeName(skill.name));
  }
  for (const item of baselineItems) {
    knownEntityNames.add(item.name);
    knownEntityNamesNormalized.add(normalizeName(item.name));
  }
  for (const faction of baselineFactions) {
    knownEntityNames.add(faction.name);
    knownEntityNamesNormalized.add(normalizeName(faction.name));
  }

  // Check if any entity in KB is not in baseline
  const suspicious = [];
  const allKBEntities = [
    ...characters.map(c => ({ id: c.id, name: c.name, type: 'character' })),
    ...factions.map(f => ({ id: f.id, name: f.name, type: 'faction' })),
    ...skills.map(s => ({ id: s.id, name: s.name, type: 'skill' })),
    ...items.map(i => ({ id: i.id, name: i.name, type: 'item' })),
  ];

  for (const entity of allKBEntities) {
    // Only flag as suspicious if the baseline has entities of this type
    const hasBaselineOfType = 
      (entity.type === 'character' && Object.values(baselineChars).flat().length > 0) ||
      (entity.type === 'faction' && baselineFactions.length > 0) ||
      (entity.type === 'skill' && baselineSkills.length > 0) ||
      (entity.type === 'item' && baselineItems.length > 0);
    
    // Check by name (exact match)
    const foundByName = knownEntityNames.has(entity.name);
    // Check by normalized name (variant match)
    const foundByVariant = knownEntityNamesNormalized.has(normalizeName(entity.name));
    // Check by contains match
    let foundByContains = false;
    for (const known of knownEntityNames) {
      if (namesMatch(entity.name, known)) {
        foundByContains = true;
        break;
      }
    }
    
    if (hasBaselineOfType && !foundByName && !foundByVariant && !foundByContains) {
      suspicious.push(entity);
    }
  }

  const totalEntities = allKBEntities.length;
  const pureEntities = totalEntities - suspicious.length;
  const score = totalEntities > 0 ? Math.round((pureEntities / totalEntities) * 1000) / 10 : 100;

  return { score, totalEntities, pureEntities, suspicious };
}

// ============================================================
// 6.5 Baseline Validation (New)
// ============================================================

// Normalize quotes for matching
function normalizeQuotes(str) {
  return str
    .replace(/[\u2018\u2019\u0027]/g, "'")  // Normalize single quotes (full-width and half-width)
    .replace(/[\u201c\u201d\u0022]/g, '"')  // Normalize double quotes (full-width and half-width)
    .replace(/[「」]/g, '"')  // Normalize Japanese quotes
    .replace(/[『』]/g, "'"); // Normalize Japanese single quotes
}

// Check if name exists in text with variant matching
function nameExistsInText(name, text) {
  // Normalize quotes for both name and text
  const normalizedName = normalizeQuotes(name);
  const normalizedText = normalizeQuotes(text);
  
  // Exact match (with normalized quotes)
  if (normalizedText.includes(normalizedName)) return true;
  
  // Try splitting name into parts and check if major parts exist
  // E.g., "金轮法王" -> check if "金轮" exists
  const parts = name.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  if (parts.length >= 2) {
    // Check if the longest part exists
    const longestPart = parts.reduce((a, b) => a.length > b.length ? a : b);
    if (longestPart.length >= 2 && normalizedText.includes(longestPart)) return true;
  }
  
  // Try removing common suffixes
  const withoutSuffix = name.replace(/法王$|大师$|真人$|掌门$|帮主$|教主$/, '');
  if (withoutSuffix !== name && withoutSuffix.length >= 2 && normalizedText.includes(withoutSuffix)) return true;
  
  // Try matching without quotes
  const nameWithoutQuotes = name.replace(/['""「」『』']/g, '');
  if (nameWithoutQuotes.length >= 4 && normalizedText.includes(nameWithoutQuotes)) return true;
  
  return false;
}

function validateBaseline() {
  const issues = [];
  
  // Load original text for verification
  const baseName = path.basename(novelDir);
  const txtPath = path.join(novelDir, `${baseName}.txt`);
  let originalText = '';
  try {
    originalText = fs.readFileSync(txtPath, 'utf8');
  } catch (e) {
    issues.push({ type: 'error', message: `Cannot read original text: ${txtPath}` });
    return { score: 0, issues };
  }
  
  // Check baseline characters exist in original text
  const baselineChars = baseline.characters || {};
  for (const importance of ['core', 'important', 'secondary', 'minor']) {
    for (const entity of (baselineChars[importance] || [])) {
      if (!nameExistsInText(entity.name, originalText)) {
        // Check aliases
        const aliases = Array.isArray(entity.alias) ? entity.alias : (entity.alias ? [entity.alias] : []);
        const foundInAlias = aliases.some(a => nameExistsInText(a, originalText));
        if (!foundInAlias) {
          issues.push({
            type: 'hallucination',
            entity_type: 'character',
            id: entity.id,
            name: entity.name,
            message: `Character "${entity.name}" not found in original text`
          });
        }
      }
    }
  }
  
  // Check baseline skills exist in original text
  for (const skill of (baseline.skills || [])) {
    if (!nameExistsInText(skill.name, originalText)) {
      issues.push({
        type: 'hallucination',
        entity_type: 'skill',
        id: skill.id,
        name: skill.name,
        message: `Skill "${skill.name}" not found in original text`
      });
    }
  }
  
  // Check baseline items exist in original text
  for (const item of (baseline.items || [])) {
    if (!nameExistsInText(item.name, originalText)) {
      issues.push({
        type: 'hallucination',
        entity_type: 'item',
        id: item.id,
        name: item.name,
        message: `Item "${item.name}" not found in original text`
      });
    }
  }
  
  // Check baseline factions exist in original text
  for (const faction of (baseline.factions || [])) {
    if (!nameExistsInText(faction.name, originalText)) {
      issues.push({
        type: 'hallucination',
        entity_type: 'faction',
        id: faction.id,
        name: faction.name,
        message: `Faction "${faction.name}" not found in original text`
      });
    }
  }
  
  // Check baseline dialogues exist in original text
  for (const dialogue of (baseline.dialogues || [])) {
    const quote = dialogue.quote || dialogue.text || '';
    if (quote && quote.length >= 10) {
      // Try multiple substrings for matching
      const substrings = [
        quote.substring(0, 30),
        quote.substring(0, 20),
        quote.substring(0, 15)
      ];
      const found = substrings.some(s => s.length >= 10 && originalText.includes(s));
      if (!found) {
        issues.push({
          type: 'hallucination',
          entity_type: 'dialogue',
          id: dialogue.id,
          name: quote.substring(0, 50) + '...',
          message: `Dialogue not found in original text`
        });
      }
    }
  }
  
  // Check for duplicate entities in KB
  const nameCounts = new Map();
  for (const c of characters) {
    const count = (nameCounts.get(c.name) || 0) + 1;
    nameCounts.set(c.name, count);
  }
  for (const [name, count] of nameCounts) {
    if (count > 1) {
      issues.push({
        type: 'duplicate',
        entity_type: 'character',
        name: name,
        count: count,
        message: `Duplicate character name "${name}" found ${count} times`
      });
    }
  }
  
  const hallucinations = issues.filter(i => i.type === 'hallucination');
  const duplicates = issues.filter(i => i.type === 'duplicate');
  const score = issues.length === 0 ? 100 : Math.max(0, 100 - (hallucinations.length * 10) - (duplicates.length * 5));
  
  return { score, issues, hallucinations, duplicates };
}

// ============================================================
// 7. Entity Quantity
// ============================================================
function assessEntityQuantity() {
  // Minimum entity counts based on chapter count
  const chapterCount = chapterSummaries.length || 0;
  
  // Define minimums based on chapter count (after Phase 2.6 cleanup)
  let minCharacters, minFactions, minSkills, minItems, minLocations;
  
  if (chapterCount >= 50) {
    minCharacters = 30; minFactions = 6; minSkills = 15; minItems = 10; minLocations = 15;
  } else if (chapterCount >= 30) {
    minCharacters = 20; minFactions = 5; minSkills = 10; minItems = 8; minLocations = 10;
  } else if (chapterCount >= 20) {
    minCharacters = 15; minFactions = 4; minSkills = 8; minItems = 6; minLocations = 8;
  } else {
    minCharacters = 8; minFactions = 3; minSkills = 5; minItems = 3; minLocations = 5;
  }
  
  const details = {
    characters: { actual: characters.length, minimum: minCharacters, passed: characters.length >= minCharacters },
    factions: { actual: factions.length, minimum: minFactions, passed: factions.length >= minFactions },
    skills: { actual: skills.length, minimum: minSkills, passed: skills.length >= minSkills },
    items: { actual: items.length, minimum: minItems, passed: items.length >= minItems },
    locations: { actual: locations.length, minimum: minLocations, passed: locations.length >= minLocations }
  };
  
  const totalTypes = Object.keys(details).length;
  const passedTypes = Object.values(details).filter(d => d.passed).length;
  const score = Math.round((passedTypes / totalTypes) * 1000) / 10;
  
  return { score, details, chapterCount };
}

// ============================================================
// Run all assessments
// ============================================================
const entityCompleteness = assessEntityCompleteness();
const relationships = assessRelationships();
const descriptionAccuracy = assessDescriptionAccuracy();
const eventCoverage = assessEventCoverage();
const dialogueQuality = assessDialogueQuality();
const crossBookPurity = assessCrossBookPurity();
const entityQuantity = assessEntityQuantity();
const baselineValidation = validateBaseline();

// Calculate overall score (weights sum to 1.0, scores are percentages)
// Note: entity_quantity is informational only, not included in score
const overallScore = Math.round(
  entityCompleteness.score * 0.25 +
  relationships.completeness * 0.15 +
  relationships.accuracy * 0.10 +
  descriptionAccuracy.score * 0.15 +
  eventCoverage.score * 0.10 +
  dialogueQuality.authenticity * 0.10 +
  dialogueQuality.representativeness * 0.05 +
  crossBookPurity.score * 0.10
);

// ============================================================
// Output report
// ============================================================
const report = {
  generated_at: new Date().toISOString(),
  novel: baseline.novel || 'Unknown',
  author: baseline.author || 'Unknown',
  overall_score: overallScore,
  metrics: {
    entity_completeness: entityCompleteness,
    entity_quantity: entityQuantity,
    relationship_completeness: {
      score: relationships.completeness,
      accuracy: relationships.accuracy,
      details: relationships.details,
      missing: relationships.missing,
      incorrect: relationships.incorrect
    },
    description_accuracy: descriptionAccuracy,
    event_coverage: eventCoverage,
    dialogue_quality: dialogueQuality,
    cross_book_purity: crossBookPurity,
    baseline_validation: baselineValidation
  }
};

// Write JSON report (to reports/ subdirectory)
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
const jsonPath = path.join(reportsDir, 'quality_report.json');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

// Write Markdown report
const mdPath = path.join(reportsDir, 'quality_report.md');
const md = generateMarkdownReport(report);
fs.writeFileSync(mdPath, md, 'utf8');

// Print summary
console.log(`\nOverall Quality Score: ${overallScore}/100\n`);
console.log('Metric Scores:');
console.log(`  Entity Completeness:       ${entityCompleteness.score}%`);
console.log(`  Entity Quantity:           ${entityQuantity.score}%`);
console.log(`  Relationship Completeness: ${relationships.completeness}%`);
console.log(`  Relationship Accuracy:     ${relationships.accuracy}%`);
console.log(`  Description Accuracy:      ${descriptionAccuracy.score}%`);
console.log(`  Event Coverage:            ${eventCoverage.score}%`);
console.log(`  Dialogue Authenticity:     ${dialogueQuality.authenticity}%`);
console.log(`  Dialogue Character Fit:    ${dialogueQuality.characterFit}%`);
console.log(`  Dialogue Represent.:       ${dialogueQuality.representativeness}%`);
console.log(`  Cross-Book Purity:         ${crossBookPurity.score}%`);
console.log(`  Baseline Validation:       ${baselineValidation.score}%`);

if (baselineValidation.hallucinations && baselineValidation.hallucinations.length > 0) {
  console.log(`\n⚠️  Baseline Hallucinations (${baselineValidation.hallucinations.length}):`);
  for (const h of baselineValidation.hallucinations.slice(0, 10)) {
    console.log(`  - ${h.entity_type}: ${h.name}`);
  }
  if (baselineValidation.hallucinations.length > 10) {
    console.log(`  ... and ${baselineValidation.hallucinations.length - 10} more`);
  }
}

if (baselineValidation.duplicates && baselineValidation.duplicates.length > 0) {
  console.log(`\n⚠️  Duplicate Entities (${baselineValidation.duplicates.length}):`);
  for (const d of baselineValidation.duplicates) {
    console.log(`  - ${d.name} (${d.count} times)`);
  }
}

// Check minimum thresholds for individual metrics
const thresholds = {
  'Entity Completeness': { score: entityCompleteness.score, min: 95 },
  'Relationship Completeness': { score: relationships.completeness, min: 95 },
  'Relationship Accuracy': { score: relationships.accuracy, min: 90 },
  'Description Accuracy': { score: descriptionAccuracy.score, min: 70 },
  'Event Coverage': { score: eventCoverage.score, min: 95 },
  'Dialogue Authenticity': { score: dialogueQuality.authenticity, min: 70 },
  'Cross-Book Purity': { score: crossBookPurity.score, min: 85 }
};

const failedMetrics = Object.entries(thresholds)
  .filter(([_, v]) => v.score < v.min)
  .map(([name, v]) => ({ name, score: v.score, min: v.min }));

if (failedMetrics.length > 0) {
  console.log(`\n❌ 未达标指标 (${failedMetrics.length}):`);
  for (const m of failedMetrics) {
    console.log(`  - ${m.name}: ${m.score}% (最低要求 ${m.min}%)`);
  }
  console.log('\n⚠️  综合分数可能达标，但单项指标未达标，必须修复后重跑！');
} else {
  console.log('\n✅ 所有单项指标均达标');
}

console.log(`\nReports written to:`);
console.log(`  ${jsonPath}`);
console.log(`  ${mdPath}`);

// ============================================================
// Markdown report generator
// ============================================================
function generateMarkdownReport(report) {
  const lines = [];
  lines.push(`# Quality Report — ${report.novel}`);
  lines.push(`\nGenerated: ${report.generated_at}`);
  lines.push(`\n## Overall Score: ${report.overall_score}/100\n`);

  lines.push('## Metric Scores\n');
  lines.push('| Metric | Score | Weight | Status |');
  lines.push('|--------|-------|--------|--------|');
  lines.push(`| Entity Completeness | ${report.metrics.entity_completeness.score}% | 0.25 | ${statusIcon(report.metrics.entity_completeness.score)} |`);
  lines.push(`| Relationship Completeness | ${report.metrics.relationship_completeness.score}% | 0.15 | ${statusIcon(report.metrics.relationship_completeness.score)} |`);
  lines.push(`| Relationship Accuracy | ${report.metrics.relationship_completeness.accuracy}% | 0.10 | ${statusIcon(report.metrics.relationship_completeness.accuracy)} |`);
  lines.push(`| Description Accuracy | ${report.metrics.description_accuracy.score}% | 0.15 | ${statusIcon(report.metrics.description_accuracy.score)} |`);
  lines.push(`| Event Coverage | ${report.metrics.event_coverage.score}% | 0.10 | ${statusIcon(report.metrics.event_coverage.score)} |`);
  lines.push(`| Dialogue Authenticity | ${report.metrics.dialogue_quality.authenticity}% | 0.10 | ${statusIcon(report.metrics.dialogue_quality.authenticity)} |`);
  lines.push(`| Dialogue Representativeness | ${report.metrics.dialogue_quality.representativeness}% | 0.05 | ${statusIcon(report.metrics.dialogue_quality.representativeness)} |`);
  lines.push(`| Cross-Book Purity | ${report.metrics.cross_book_purity.score}% | 0.10 | ${statusIcon(report.metrics.cross_book_purity.score)} |`);

  // Entity Quantity Details (informational only)
  lines.push('\n## Entity Quantity (参考建议，不计入综合分数)\n');
  const eq = report.metrics.entity_quantity;
  lines.push(`Chapter Count: ${eq.chapterCount}\n`);
  lines.push('| Type | Actual | Minimum | Status |');
  lines.push('|------|--------|---------|--------|');
  for (const [key, val] of Object.entries(eq.details)) {
    lines.push(`| ${key} | ${val.actual} | ${val.minimum} | ${val.passed ? '✅' : '⚠️'} |`);
  }

  // Entity Completeness Details
  lines.push('\n## Entity Completeness\n');
  const ec = report.metrics.entity_completeness;
  lines.push('| Importance | Expected | Actual | Coverage |');
  lines.push('|------------|----------|--------|----------|');
  for (const [key, val] of Object.entries(ec.details)) {
    lines.push(`| ${importanceLabel(key)} | ${val.expected} | ${val.actual} | ${val.coverage}% |`);
  }
  if (ec.missing.length > 0) {
    lines.push(`\n### Missing Entities (${ec.missing.length})\n`);
    lines.push('| ID | Name | Importance | Reason |');
    lines.push('|-----|------|------------|--------|');
    for (const m of ec.missing) {
      lines.push(`| ${m.id} | ${m.name} | ${m.importance} | ${m.reason} |`);
    }
  }

  // Relationship Details
  lines.push('\n## Relationship Completeness\n');
  const rc = report.metrics.relationship_completeness;
  lines.push('| Importance | Expected | Actual | Coverage |');
  lines.push('|------------|----------|--------|----------|');
  for (const [key, val] of Object.entries(rc.details)) {
    const coverage = val.expected > 0 ? Math.round((val.actual / val.expected) * 100) : 100;
    lines.push(`| ${importanceLabel(key)} | ${val.expected} | ${val.actual} | ${coverage}% |`);
  }
  if (rc.missing.length > 0) {
    lines.push(`\n### Missing Relationships (${rc.missing.length})\n`);
    lines.push('| Source | Target | Type | Importance |');
    lines.push('|--------|--------|------|------------|');
    for (const m of rc.missing) {
      lines.push(`| ${m.source} | ${m.target} | ${m.type} | ${m.importance || 'secondary'} |`);
    }
  }
  if (rc.incorrect && rc.incorrect.length > 0) {
    lines.push(`\n### Incorrect Relationship Types (${rc.incorrect.length})\n`);
    lines.push('| Source | Target | Expected | Actual |');
    lines.push('|--------|--------|----------|--------|');
    for (const i of rc.incorrect) {
      lines.push(`| ${i.source} | ${i.target} | ${i.expected} | ${i.actual} |`);
    }
  }

  // Event Coverage Details
  lines.push('\n## Event Coverage\n');
  const ev = report.metrics.event_coverage;
  lines.push('| Type | Expected | Actual | Coverage |');
  lines.push('|------|----------|--------|----------|');
  for (const [key, val] of Object.entries(ev.details)) {
    const coverage = val.expected > 0 ? Math.round((val.actual / val.expected) * 100) : 100;
    lines.push(`| ${key} | ${val.expected} | ${val.actual} | ${coverage}% |`);
  }
  if (ev.missing.length > 0) {
    lines.push(`\n### Missing Events (${ev.missing.length})\n`);
    lines.push('| Chapter | Event | Importance |');
    lines.push('|---------|-------|------------|');
    for (const m of ev.missing) {
      lines.push(`| ${m.chapter} | ${m.event} | ${m.importance} |`);
    }
  }

  // Dialogue Quality Details
  lines.push('\n## Dialogue Quality\n');
  const dq = report.metrics.dialogue_quality;
  lines.push(`- Total dialogues: ${dq.details.total}`);
  lines.push(`- With speaker: ${dq.details.withSpeaker}`);
  lines.push(`- With listener: ${dq.details.withListener}`);
  lines.push(`- Baseline checked: ${dq.details.baselineChecked}`);
  lines.push(`- Baseline matched: ${dq.details.baselineMatched}`);
  if (dq.issues.length > 0) {
    lines.push(`\n### Dialogue Issues (${dq.issues.length})\n`);
    lines.push('| Index | Chapter | Speaker | Issue |');
    lines.push('|-------|---------|---------|-------|');
    for (const i of dq.issues) {
      lines.push(`| ${i.index} | ${i.chapter} | ${i.speaker} | ${i.issue} |`);
    }
  }

  // Cross-Book Purity Details
  lines.push('\n## Cross-Book Purity\n');
  const cb = report.metrics.cross_book_purity;
  lines.push(`- Total entities: ${cb.totalEntities}`);
  lines.push(`- Pure entities: ${cb.pureEntities}`);
  lines.push(`- Suspicious: ${cb.suspicious.length}`);
  if (cb.suspicious.length > 0) {
    lines.push(`\n### Suspicious Entities (${cb.suspicious.length})\n`);
    lines.push('| ID | Name | Type |');
    lines.push('|-----|------|------|');
    for (const s of cb.suspicious) {
      lines.push(`| ${s.id} | ${s.name} | ${s.type} |`);
    }
  }

  // Baseline Validation Details
  lines.push('\n## Baseline Validation\n');
  const bv = report.metrics.baseline_validation;
  lines.push(`- Score: ${bv.score}%`);
  lines.push(`- Hallucinations: ${(bv.hallucinations || []).length}`);
  lines.push(`- Duplicates: ${(bv.duplicates || []).length}`);
  if (bv.hallucinations && bv.hallucinations.length > 0) {
    lines.push(`\n### Baseline Hallucinations (${bv.hallucinations.length})\n`);
    lines.push('| Type | ID | Name | Issue |');
    lines.push('|------|-----|------|-------|');
    for (const h of bv.hallucinations) {
      lines.push(`| ${h.entity_type} | ${h.id} | ${h.name} | ${h.message} |`);
    }
  }
  if (bv.duplicates && bv.duplicates.length > 0) {
    lines.push(`\n### Duplicate Entities (${bv.duplicates.length})\n`);
    lines.push('| Name | Count |');
    lines.push('|------|-------|');
    for (const d of bv.duplicates) {
      lines.push(`| ${d.name} | ${d.count} |`);
    }
  }

  return lines.join('\n');
}

function statusIcon(score) {
  if (score >= 90) return '✅';
  if (score >= 75) return '⚠️';
  return '❌';
}
