'use strict';

const crypto = require('node:crypto');

const REQUIRED_WARNING_FIELDS = Object.freeze([
  'code', 'severity', 'category', 'name', 'chapters', 'reason', 'resolution'
]);

function buildReviewReport({ sourceHash, finalDataHash, warnings }) {
  const entries = (warnings || []).map(warning => ({
    code: warning.code,
    severity: 'warning',
    category: warning.category,
    name: warning.name,
    chapters: warning.chapters || [],
    source_refs: warning.source_refs || [],
    member_refs: warning.member_refs || [],
    reason: warning.reason || '',
    resolution: warning.resolution || 'pending'
  }));

  return {
    schema_version: 1,
    source_hash: sourceHash,
    final_data_hash: finalDataHash,
    summary: {
      warning_count: entries.length,
      info_count: 0,
      auto_resolved_count: 0
    },
    warnings: entries
  };
}

function validateReviewReport(report) {
  const issues = [];
  if (!report || typeof report !== 'object') {
    return [{ code: 'REVIEW_REPORT_INVALID', path: '$', target: 'not an object' }];
  }
  if (report.schema_version !== 1) {
    issues.push({ code: 'REVIEW_REPORT_INVALID', path: 'schema_version', target: report.schema_version });
  }
  if (typeof report.source_hash !== 'string') {
    issues.push({ code: 'REVIEW_REPORT_INVALID', path: 'source_hash', target: report.source_hash });
  }
  if (typeof report.final_data_hash !== 'string') {
    issues.push({ code: 'REVIEW_REPORT_INVALID', path: 'final_data_hash', target: report.final_data_hash });
  }
  if (!report.summary || typeof report.summary !== 'object') {
    issues.push({ code: 'REVIEW_REPORT_INVALID', path: 'summary', target: 'missing' });
  } else {
    if (report.summary.info_count !== 0) {
      issues.push({ code: 'REVIEW_REPORT_INVALID', path: 'summary.info_count', target: report.summary.info_count });
    }
    if (report.summary.auto_resolved_count !== 0) {
      issues.push({ code: 'REVIEW_REPORT_INVALID', path: 'summary.auto_resolved_count', target: report.summary.auto_resolved_count });
    }
    if (report.summary.warning_count !== (Array.isArray(report.warnings) ? report.warnings.length : 0)) {
      issues.push({ code: 'REVIEW_REPORT_INVALID', path: 'summary.warning_count', target: report.summary.warning_count });
    }
  }
  if (!Array.isArray(report.warnings)) {
    issues.push({ code: 'REVIEW_REPORT_INVALID', path: 'warnings', target: 'not an array' });
  } else {
    report.warnings.forEach((entry, index) => {
      for (const field of REQUIRED_WARNING_FIELDS) {
        if (entry[field] === undefined || entry[field] === null) {
          issues.push({ code: 'REVIEW_REPORT_INVALID', path: `warnings[${index}].${field}`, target: 'missing' });
        }
      }
      if (entry.severity !== 'warning') {
        issues.push({ code: 'REVIEW_REPORT_INVALID', path: `warnings[${index}].severity`, target: entry.severity });
      }
    });
  }
  return issues;
}

function hashReport(report) {
  const content = `${JSON.stringify(report, null, 2)}\n`;
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}

module.exports = { buildReviewReport, hashReport, validateReviewReport };
