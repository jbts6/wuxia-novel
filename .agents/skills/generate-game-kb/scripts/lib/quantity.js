'use strict';

const RANGES = Object.freeze({
  short: Object.freeze({
    characters: [10, 35], events: [20, 80], items: [3, 12], skills: [5, 20],
  }),
  medium: Object.freeze({
    characters: [25, 75], events: [60, 220], items: [6, 20], skills: [10, 35],
  }),
  long: Object.freeze({
    characters: [45, 120], events: [150, 400], items: [10, 30], skills: [15, 50],
  })
});

function sizeBand(sourceCharCount) {
  if (sourceCharCount < 150_000) return 'short';
  if (sourceCharCount <= 500_000) return 'medium';
  return 'long';
}

function buildQuantityReport(book, sourceCharCount, chapterCount) {
  const band = sizeBand(sourceCharCount);
  const ranges = { ...RANGES[band], chapter_summaries: [chapterCount, chapterCount] };
  const categories = {};
  const warnings = [];
  for (const [category, targetRange] of Object.entries(ranges)) {
    const actual = Array.isArray(book?.[category]) ? book[category].length : 0;
    const outsideRange = actual < targetRange[0] || actual > targetRange[1];
    categories[category] = {
      actual,
      target_range: [...targetRange],
      per_chapter_density: chapterCount > 0 ? Number((actual / chapterCount).toFixed(3)) : 0,
      outside_range: outsideRange
    };
    if (outsideRange) {
      warnings.push({ code: 'QUANTITY_OUTSIDE_GUIDANCE', category, actual, target_range: [...targetRange] });
    }
  }
  return {
    schema_version: 1,
    size_band: band,
    source_char_count: sourceCharCount,
    chapter_count: chapterCount,
    review_consumed: false,
    categories,
    warnings
  };
}

module.exports = { RANGES, buildQuantityReport, sizeBand };
