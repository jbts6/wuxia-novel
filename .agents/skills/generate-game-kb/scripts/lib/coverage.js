'use strict';

const CANDIDATE_CATEGORIES = Object.freeze([
  'characters',
  
  'items',
  'skills',
  
  'factions',
  
]);
const IMPORTANT_EVENT_LEVELS = new Set(['核心', '重要', 'core', 'important']);

function records(chapter, category) {
  return Array.isArray(chapter?.[category]) ? chapter[category] : [];
}

function sortedNumbers(values) {
  return [...values].sort((left, right) => left - right);
}

function buildChapterCoverage(chapters) {
  const input = Array.isArray(chapters) ? chapters : [];
  const categories = {};
  for (const category of CANDIDATE_CATEGORIES) {
    const chapterNumbers = new Set();
    let candidateCount = 0;
    for (const chapter of input) {
      const candidates = records(chapter, category);
      candidateCount += candidates.length;
      if (candidates.length > 0 && Number.isInteger(chapter?.chapter)) chapterNumbers.add(chapter.chapter);
    }
    categories[category] = {
      candidate_count: candidateCount,
      chapters: sortedNumbers(chapterNumbers)
    };
  }

  const importantEvents = [];
  const quotableEvents = [];
  const eventKeysWithDialogues = new Set();
  for (const chapter of input) {
    for (const event of records(chapter, 'events')) {
      if (IMPORTANT_EVENT_LEVELS.has(event?.importance)) importantEvents.push(event);
      if (IMPORTANT_EVENT_LEVELS.has(event?.importance) && event?.quote_status === 'quotable') {
        quotableEvents.push(event);
      }
    }
      if (typeof dialogue?.event_local_key === 'string') eventKeysWithDialogues.add(dialogue.event_local_key);
    }
  }

  return {
    chapter_count: input.length,
    categories,
    events: {
      important_count: importantEvents.length,
      quotable_count: quotableEvents.length
    },
      quotable_event_count_with_candidates: quotableEvents
        .filter(event => eventKeysWithDialogues.has(event?.local_key))
        .length
    }
  };
}

module.exports = { CANDIDATE_CATEGORIES, buildChapterCoverage };
