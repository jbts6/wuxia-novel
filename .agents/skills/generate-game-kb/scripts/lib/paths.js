'use strict';

const path = require('node:path');

function pathsFor(novelDir) {
  const novel = path.resolve(novelDir);
  const work = path.join(novel, '.game-kb-work');
  return {
    novel,
    work,
    manifest: path.join(work, 'manifest.json'),
    progress: path.join(work, 'progress.json'),
    manualReview: path.join(work, 'manual_review.json'),
    sourceChapters: path.join(work, 'source', 'chapters'),
    drafts: path.join(work, 'drafts'),
    chapters: path.join(work, 'chapters'),
    merged: path.join(work, 'merged', 'book.json'),
    preCleanQuantity: path.join(work, 'merged', 'pre_clean_quantity.json'),
    cleaned: path.join(work, 'cleaned', 'book.json'),
    finalRoot: path.join(work, 'final'),
    finalIdPlan: path.join(work, 'final', 'id_plan.json'),
    finalData: path.join(work, 'final', 'data'),
    finalReports: path.join(work, 'final', 'reports'),
    gameMaterials: path.join(work, 'final', 'reports', 'game_materials.json'),
    quantityReport: path.join(work, 'final', 'reports', 'quantity_report.json'),
    qualitySample: path.join(work, 'final', 'reports', 'quality_sample.json'),
    qualityReport: path.join(work, 'final', 'reports', 'quality_report.json')
  };
}

module.exports = { pathsFor };
