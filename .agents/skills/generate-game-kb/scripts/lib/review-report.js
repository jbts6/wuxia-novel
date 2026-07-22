'use strict';

const crypto = require('node:crypto');

const REPORT_FIELDS = Object.freeze([
  'report_version', 'source_hash', 'final_data_hash', 'summary', 'entries'
]);
const SUMMARY_FIELDS = Object.freeze(['warning_count', 'by_code', 'by_category']);
const WARNING_FIELDS = Object.freeze([
  'code', 'severity', 'category', 'name', 'chapter_numbers',
  'source_refs', 'member_refs', 'reason', 'resolution'
]);

function issue(path, target) {
  return { code: 'REVIEW_REPORT_INVALID', path, target };
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'zh-CN');
}

function entryKey(entry) {
  return [entry.code, entry.category, entry.name, JSON.stringify(entry.chapter_numbers), JSON.stringify(entry.member_refs)]
    .join('\0');
}

function sortedCounts(entries, field) {
  const counts = new Map();
  for (const entry of entries) counts.set(entry[field], (counts.get(entry[field]) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => compareText(left, right)));
}

function buildReviewReport({ sourceHash, finalDataHash, warnings }) {
  const entries = (Array.isArray(warnings) ? warnings : []).map(warning => ({
    code: warning.code,
    severity: 'warning',
    category: warning.category,
    name: warning.name,
    chapter_numbers: [...(warning.chapter_numbers || [])],
    source_refs: structuredClone(warning.source_refs || []),
    member_refs: [...(warning.member_refs || [])],
    reason: warning.reason,
    resolution: warning.resolution
  })).sort((left, right) => compareText(entryKey(left), entryKey(right)));

  return {
    report_version: 1,
    source_hash: sourceHash,
    final_data_hash: finalDataHash,
    summary: {
      warning_count: entries.length,
      by_code: sortedCounts(entries, 'code'),
      by_category: sortedCounts(entries, 'category')
    },
    entries
  };
}

function sameFields(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value)) === JSON.stringify(expected);
}

function validCountMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([key, count]) => key !== '' && Number.isInteger(count) && count > 0);
}

function validateReviewReport(report) {
  if (!sameFields(report, REPORT_FIELDS)) return [issue('$', 'unexpected report fields')];
  const issues = [];
  if (report.report_version !== 1) issues.push(issue('report_version', report.report_version));
  if (typeof report.source_hash !== 'string' || report.source_hash === '') {
    issues.push(issue('source_hash', report.source_hash));
  }
  if (typeof report.final_data_hash !== 'string' || report.final_data_hash === '') {
    issues.push(issue('final_data_hash', report.final_data_hash));
  }
  if (!sameFields(report.summary, SUMMARY_FIELDS)) {
    issues.push(issue('summary', 'unexpected summary fields'));
  }
  if (!Array.isArray(report.entries)) {
    issues.push(issue('entries', 'not an array'));
    return issues;
  }

  report.entries.forEach((entry, index) => {
    const label = `entries[${index}]`;
    if (!sameFields(entry, WARNING_FIELDS)) {
      issues.push(issue(label, 'unexpected warning fields'));
      return;
    }
    for (const field of ['code', 'category', 'name', 'reason', 'resolution']) {
      if (typeof entry[field] !== 'string' || entry[field] === '') {
        issues.push(issue(`${label}.${field}`, entry[field]));
      }
    }
    if (entry.severity !== 'warning') issues.push(issue(`${label}.severity`, entry.severity));
    if (!Array.isArray(entry.chapter_numbers)
      || entry.chapter_numbers.length === 0
      || entry.chapter_numbers.some(chapter => !Number.isInteger(chapter))) {
      issues.push(issue(`${label}.chapter_numbers`, entry.chapter_numbers));
    }
    for (const field of ['source_refs', 'member_refs']) {
      if (!Array.isArray(entry[field]) || entry[field].length === 0) {
        issues.push(issue(`${label}.${field}`, entry[field]));
      }
    }
  });

  if (!report.summary || typeof report.summary !== 'object') return issues;
  if (report.summary.warning_count !== report.entries.length) {
    issues.push(issue('summary.warning_count', report.summary.warning_count));
  }
  if (!validCountMap(report.summary.by_code)
    || JSON.stringify(report.summary.by_code) !== JSON.stringify(sortedCounts(report.entries, 'code'))) {
    issues.push(issue('summary.by_code', report.summary.by_code));
  }
  if (!validCountMap(report.summary.by_category)
    || JSON.stringify(report.summary.by_category) !== JSON.stringify(sortedCounts(report.entries, 'category'))) {
    issues.push(issue('summary.by_category', report.summary.by_category));
  }
  return issues;
}

function hashReport(report) {
  const content = `${JSON.stringify(report, null, 2)}\n`;
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}

module.exports = { buildReviewReport, hashReport, validateReviewReport };
