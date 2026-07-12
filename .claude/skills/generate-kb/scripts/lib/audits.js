#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  FINAL_DATA_FILES,
  evidenceFieldsFor,
  hasContent,
  validateFinalData
} = require('./final-data-contract');
const { discoverChapterFiles, matchCompleteCitation, splitLines } = require('./source');

const ENTITY_FILES = FINAL_DATA_FILES.filter(filename =>
  !['dialogues.json', 'chapter_summaries.json'].includes(filename)
);

function loadJson(filename, fallback = null) {
  return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : fallback;
}

function loadChapterLines(novelDir) {
  return new Map(discoverChapterFiles(novelDir).map(entry => [
    entry.chapter,
    splitLines(fs.readFileSync(entry.file, 'utf8'))
  ]));
}

function refIsGrounded(chapters, ref, fallbackChapter = null) {
  const chapter = Number(ref?.chapter ?? fallbackChapter);
  const lines = chapters.get(chapter);
  if (!lines || !ref?.text || !Number.isInteger(ref.line_start) ||
      !Number.isInteger(ref.line_end) || ref.line_start < 1 || ref.line_end < ref.line_start) {
    return false;
  }
  return matchCompleteCitation(lines, ref.text, {
    lineStart: ref.line_start,
    lineEnd: ref.line_end
  }).matched;
}

function collectEvidenceIntegrity(novelDir) {
  const chapters = loadChapterLines(novelDir);
  const finalData = validateFinalData(novelDir);
  const entitiesWithoutGroundedRefs = [];
  let entityTotal = 0;
  let entityGrounded = 0;
  const descriptionsWithoutRefs = [];

  function checkDescriptionRefs(record, id, filename, fallbackChapter = null) {
    for (const field of evidenceFieldsFor(filename, record)) {
      const configured = record.field_source_refs?.[field];
      const refs = Array.isArray(configured) ? configured : configured ? [configured] : [];
      if (!refs.some(ref => refIsGrounded(chapters, ref, fallbackChapter))) {
        descriptionsWithoutRefs.push(`${id}.${field}`);
      }
    }
  }

  for (const filename of ENTITY_FILES) {
    for (const [index, entity] of (finalData.records_by_file[filename] ?? []).entries()) {
      entityTotal += 1;
      const id = entity.id ?? `${filename}#${index}`;
      const refs = Array.isArray(entity.source_refs) ? entity.source_refs : [];
      if (refs.some(ref => refIsGrounded(chapters, ref))) entityGrounded += 1;
      else entitiesWithoutGroundedRefs.push(id);
      checkDescriptionRefs(entity, id, filename);
    }
  }
  for (const [index, event] of loadJson(path.join(novelDir, 'build', 'events.json'), []).entries()) {
    entityTotal += 1;
    const id = event.id ?? `events.json#${index}`;
    const refs = Array.isArray(event.source_refs) ? event.source_refs : [];
    if (refs.some(ref => refIsGrounded(chapters, ref))) entityGrounded += 1;
    else entitiesWithoutGroundedRefs.push(id);
    for (const field of ['description', 'consequences'].filter(name => hasContent(event?.[name]))) {
      const configured = event.field_source_refs?.[field];
      const fieldRefs = Array.isArray(configured) ? configured : configured ? [configured] : [];
      if (!fieldRefs.some(ref => refIsGrounded(chapters, ref))) {
        descriptionsWithoutRefs.push(`${id}.${field}`);
      }
    }
  }
  for (const [index, summary] of (
    finalData.records_by_file['chapter_summaries.json'] ?? []
  ).entries()) {
    entityTotal += 1;
    const id = summary.id ?? `chapter_summary:${summary.chapter ?? index}`;
    const refs = Array.isArray(summary.source_refs) ? summary.source_refs : [];
    if (refs.some(ref => refIsGrounded(chapters, ref, summary.chapter))) entityGrounded += 1;
    else entitiesWithoutGroundedRefs.push(id);
    checkDescriptionRefs(summary, id, 'chapter_summaries.json', summary.chapter);
  }

  const dialogues = finalData.records_by_file['dialogues.json'] ?? [];
  let dialogueGrounded = 0;
  const ungroundedDialogues = [];
  dialogues.forEach((dialogue, index) => {
    const id = dialogue.id ?? `dialogue#${index}`;
    const grounded = refIsGrounded(chapters, {
      chapter: dialogue.chapter,
      line_start: dialogue.line_start,
      line_end: dialogue.line_end,
      text: dialogue.text
    });
    if (grounded) dialogueGrounded += 1;
    else ungroundedDialogues.push(id);

    const contextGrounded = typeof dialogue.context === 'string' && dialogue.context.trim() &&
      refIsGrounded(chapters, {
        chapter: dialogue.chapter,
        line_start: dialogue.context_line_start,
        line_end: dialogue.context_line_end,
        text: dialogue.context
      });
    if (!contextGrounded) descriptionsWithoutRefs.push(`${id}.context`);
  });

  const verification = loadJson(path.join(novelDir, 'reports', 'verification_report.json'));
  return {
    missing_data_files: finalData.missing_data_files,
    invalid_data_files: finalData.invalid_data_files,
    schema_errors: finalData.schema_errors,
    enrichment_errors: finalData.enrichment_errors,
    entities_without_grounded_refs: entitiesWithoutGroundedRefs,
    descriptions_without_refs: descriptionsWithoutRefs,
    ungrounded_dialogues: ungroundedDialogues,
    entity_total: entityTotal,
    entity_grounded: entityGrounded,
    dialogue_total: dialogues.length,
    dialogue_grounded: dialogueGrounded,
    final_data_hash: finalData.final_data_hash,
    verification_data_hash_valid: Boolean(
      finalData.final_data_hash && verification?.final_data_hash === finalData.final_data_hash
    ),
    verification_file_errors: Array.isArray(verification?.file_errors)
      ? verification.file_errors
      : verification ? [] : ['verification report is missing'],
    verification_weak: Number.isInteger(verification?.grand_total?.weak)
      ? verification.grand_total.weak
      : null,
    verification_unverified: Number.isInteger(verification?.grand_total?.unverified)
      ? verification.grand_total.unverified
      : null,
    grand_grounded_ratio: typeof verification?.grand_grounded_ratio === 'number'
      ? verification.grand_grounded_ratio
      : null
  };
}

function exemptionIds(exemptions, key) {
  return new Set((exemptions?.[key] ?? []).flatMap(item => {
    if (typeof item === 'string') return [item];
    return item?.id && String(item.reason ?? '').trim() ? [item.id] : [];
  }));
}

function collectSemanticCoverage(novelDir) {
  const finalData = validateFinalData(novelDir);
  const eventsPath = path.join(novelDir, 'build', 'events.json');
  const events = loadJson(eventsPath, []);
  const dialogues = finalData.records_by_file['dialogues.json'] ?? [];
  const characters = finalData.records_by_file['characters.json'] ?? [];
  const exemptions = loadJson(path.join(novelDir, 'build', 'semantic-exemptions.json'), {});
  const eventExemptions = exemptionIds(exemptions, 'main_events');
  const personaExemptions = exemptionIds(exemptions, 'personas');
  const dialogueIds = new Set(dialogues.map((dialogue, index) => dialogue.id ?? `dialogue#${index}`));
  const blockingSchemaErrors = [
    ...finalData.schema_errors.filter(error => error.startsWith('dialogues.json/')),
    ...finalData.enrichment_errors.filter(error => error.startsWith('dialogues.json/'))
  ];

  dialogues.forEach((dialogue, index) => {
    const id = String(dialogue?.id ?? '').trim();
    const label = id || `dialogue#${index}`;
    const selectionType = String(dialogue?.selection_type ?? '').trim();
    if (!id) blockingSchemaErrors.push(`${label} is missing id`);
    if (!['event', 'persona', 'both'].includes(selectionType)) {
      blockingSchemaErrors.push(`${label}.selection_type must be event, persona, or both`);
    }
    if (!String(dialogue?.selection_reason ?? '').trim()) {
      blockingSchemaErrors.push(`${label}.selection_reason is required`);
    }
    if (!String(dialogue?.context ?? '').trim()) {
      blockingSchemaErrors.push(`${label}.context is required`);
    }
    if (!Number.isInteger(dialogue?.context_line_start) ||
        !Number.isInteger(dialogue?.context_line_end) ||
        dialogue.context_line_start < 1 || dialogue.context_line_end < dialogue.context_line_start) {
      blockingSchemaErrors.push(`${label}.context_line_start/context_line_end are invalid`);
    }
    if (!String(dialogue?.speaker ?? '').trim() && !String(dialogue?.speaker_name ?? '').trim()) {
      blockingSchemaErrors.push(`${label} requires speaker or speaker_name`);
    }
    if (['event', 'both'].includes(selectionType) && !String(dialogue?.event_id ?? '').trim()) {
      blockingSchemaErrors.push(`${label}.event_id is required for ${selectionType} dialogue`);
    }
    if (['persona', 'both'].includes(selectionType) &&
        (!Array.isArray(dialogue?.trait_tags) || dialogue.trait_tags.length === 0)) {
      blockingSchemaErrors.push(`${label}.trait_tags are required for ${selectionType} dialogue`);
    }
  });

  const mainEvents = events.filter(event =>
    ['main', '主要', 'core'].includes(event.importance) ||
    ['main', '主要'].includes(event.level) || event.type === 'main'
  );
  const mainEventsMissingDialogue = mainEvents.filter(event => {
    if (eventExemptions.has(event.id)) return false;
    if (String(event.no_suitable_dialogue ?? '').trim()) return false;
    if (dialogues.some(dialogue => dialogue.event_id === event.id)) return false;
    return !(event.dialogue_ids ?? []).some(id => dialogueIds.has(id));
  }).map(event => event.id ?? event.name);
  if (!fs.existsSync(eventsPath)) mainEventsMissingDialogue.push('event inventory missing');
  else if (mainEvents.length === 0) mainEventsMissingDialogue.push('no main events classified');

  const important = characters.filter(character =>
    ['core', 'important', '核心', '重要'].includes(character.importance)
  );
  const semanticNonVacuityErrors = important.length === 0
    ? ['no core or important characters classified']
    : [];
  const personasMissingDialogue = important.filter(character => {
    if (personaExemptions.has(character.id)) return false;
    return !dialogues.some(dialogue => {
      const speakerMatches = dialogue.speaker === character.id ||
        dialogue.speaker_name === character.name;
      const selectedForPersona = ['persona', 'both', 'characterization', '人物特征']
        .includes(dialogue.selection_type);
      const hasReason = (Array.isArray(dialogue.trait_tags) && dialogue.trait_tags.length > 0) ||
        String(dialogue.selection_reason ?? '').trim();
      return speakerMatches && selectedForPersona && hasReason;
    });
  }).map(character => character.id ?? character.name);

  const cross = loadJson(path.join(novelDir, 'reports', 'cross_validation_report.json'));
  return {
    main_events_missing_dialogue: mainEventsMissingDialogue,
    personas_missing_dialogue: personasMissingDialogue,
    cross_validation_errors: Number.isInteger(cross?.summary?.errors) ? cross.summary.errors : null,
    cross_validation_data_hash_valid: Boolean(
      finalData.final_data_hash && cross?.final_data_hash === finalData.final_data_hash
    ),
    blocking_schema_errors: blockingSchemaErrors,
    semantic_non_vacuity_errors: semanticNonVacuityErrors,
    counts: {
      main_events: mainEvents.length,
      important_characters: important.length,
      dialogues: dialogues.length
    }
  };
}

module.exports = {
  collectEvidenceIntegrity,
  collectSemanticCoverage,
  loadChapterLines,
  refIsGrounded
};
