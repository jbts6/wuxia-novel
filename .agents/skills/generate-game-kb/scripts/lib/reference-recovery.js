'use strict';

const { stableHash } = require('./io');

function stableMarker(value) {
  return JSON.stringify(value);
}

function uniqueSorted(values, compare = undefined) {
  return [...new Map(values.map(value => [stableMarker(value), value])).values()].sort(compare);
}

function compareSourceRefs(left, right) {
  return Number(left?.chapter) - Number(right?.chapter)
    || Number(left?.line_start ?? Number.MAX_SAFE_INTEGER)
      - Number(right?.line_start ?? Number.MAX_SAFE_INTEGER)
    || String(left?.text ?? '').localeCompare(String(right?.text ?? ''), 'zh-CN');
}

function matchingProvenance(issue, provenance) {
  return provenance.filter(entry => (
    entry.owner_category === issue.owner_category
    && entry.owner_name === issue.owner_name
    && entry.relation_field === issue.relation_field
    && entry.target_category === issue.target_category
    && entry.target_name === issue.target
  ));
}

/** Hashes the report payload without trusting or including an existing report_hash field. */
function hashReferenceRecoveryReport(report) {
  const { report_hash: ignored, ...unsigned } = report;
  void ignored;
  return stableHash(unsigned);
}

/** Builds the immutable evidence map used to open a derived relationship recovery run. */
function buildReferenceRecoveryReport(input) {
  const relationships = input.issues.map(issue => {
    const matches = matchingProvenance(issue, input.relationProvenance);
    const sourceRefs = uniqueSorted(
      matches.flatMap(entry => entry.source_refs || []),
      compareSourceRefs
    );
    const sourceChapters = uniqueSorted([
      ...matches.map(entry => entry.chapter),
      ...sourceRefs.map(ref => ref.chapter)
    ].filter(Number.isInteger), (left, right) => left - right);
    return {
      code: issue.code,
      owner_category: issue.owner_category,
      owner_name: issue.owner_name,
      relation_field: issue.relation_field,
      relation_path: issue.path,
      target_category: issue.target_category,
      target_name: issue.target,
      member_refs: uniqueSorted(matches.map(entry => entry.member_ref)),
      source_chapters: sourceChapters,
      source_refs: sourceRefs
    };
  }).sort((left, right) => stableMarker(left).localeCompare(stableMarker(right), 'zh-CN'));
  const recoveryUnits = uniqueSorted(
    relationships.flatMap(entry => entry.source_chapters)
      .map(chapter => `chapter:${String(chapter).padStart(3, '0')}`)
  );
  const report = {
    schema_version: 1,
    parent_run: input.parentRun,
    source_hash: input.sourceHash,
    artifact_manifest_hash: input.artifactManifestHash,
    recovery_units: recoveryUnits,
    relationships
  };
  return { ...report, report_hash: hashReferenceRecoveryReport(report) };
}

module.exports = { buildReferenceRecoveryReport, hashReferenceRecoveryReport };
