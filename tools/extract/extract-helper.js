#!/usr/bin/env node
// 骨架+深度提取 Sub-Agent 协调助手
// 供主 agent 读取配置和执行 sub-agent 提取流程

const fs = require('fs');
const path = require('path');

// 默认配置（可通过命令行参数覆盖）
const config = {
  novelDir: process.argv[2] || "金庸/天龙八部",
  step: process.argv[3] || "status", // status | skeleton | deep | batch-skeleton | batch-deep
  chapters: process.argv.slice(4).map(Number), // 指定章节号
};

const paths = {
  chapterTextDir: path.join(config.novelDir, "ch_formatted"),
  chapterOriginalDir: path.join(config.novelDir, "ch_original"),
  chaptersOutputDir: path.join(config.novelDir, "chapters"),
  progressFile: path.join(config.novelDir, "progress.json"),
  skeletonPrompt: "tools/extract/skeleton-subagent-prompt.md",
  deepPrompt: "tools/extract/deep-subagent-prompt.md",
};

function loadProgress() {
  if (fs.existsSync(paths.progressFile)) {
    return JSON.parse(fs.readFileSync(paths.progressFile, 'utf-8'));
  }
  return {
    skeleton: { total: 0, done: [], failed: [], pending: [] },
    deep: { total: 0, done: [], failed: [], pending: [] },
    merge: false,
    gamify: false,
    rag: false
  };
}

function saveProgress(progress) {
  fs.writeFileSync(paths.progressFile, JSON.stringify(progress, null, 2), 'utf-8');
}

function getChapterText(chNum) {
  const padded = String(chNum).padStart(2, '0');
  let textPath = path.join(paths.chapterTextDir, `ch_${padded}.md`);
  if (!fs.existsSync(textPath)) {
    textPath = path.join(paths.chapterOriginalDir, `ch_${padded}.md`);
  }
  if (!fs.existsSync(textPath)) return null;
  return fs.readFileSync(textPath, 'utf-8');
}

function getSkeleton(chNum) {
  const padded = String(chNum).padStart(2, '0');
  const skelPath = path.join(paths.chaptersOutputDir, `ch_${padded}_skeleton.json`);
  if (!fs.existsSync(skelPath)) return null;
  return JSON.parse(fs.readFileSync(skelPath, 'utf-8'));
}

function formatSkeletonIndex(skeleton) {
  const lines = [];

  if (skeleton.characters && skeleton.characters.length) {
    lines.push("### 人物");
    skeleton.characters.forEach(c => {
      lines.push(`- ${c.id}: ${c.name} (${c.identity || ''}) - ${c.one_line || ''}`);
    });
  }

  if (skeleton.factions && skeleton.factions.length) {
    lines.push("\n### 门派");
    skeleton.factions.forEach(f => {
      lines.push(`- ${f.id}: ${f.name} (${f.type || ''}) - ${f.one_line || ''}`);
    });
  }

  if (skeleton.locations && skeleton.locations.length) {
    lines.push("\n### 地点");
    skeleton.locations.forEach(l => {
      lines.push(`- ${l.id}: ${l.name} (${l.region || ''}) - ${l.one_line || ''}`);
    });
  }

  if (skeleton.skills && skeleton.skills.length) {
    lines.push("\n### 武功");
    skeleton.skills.forEach(s => {
      lines.push(`- ${s.id}: ${s.name} (${s.type || ''}) - ${s.one_line || ''}`);
    });
  }

  if (skeleton.items && skeleton.items.length) {
    lines.push("\n### 物品");
    skeleton.items.forEach(i => {
      lines.push(`- ${i.id}: ${i.name} (${i.type || ''}) - ${i.one_line || ''}`);
    });
  }

  return lines.join('\n');
}

function getChaptersToProcess(step) {
  const progress = loadProgress();
  const done = new Set(progress[step].done);
  const total = progress[step].total;

  if (config.chapters.length > 0) {
    return config.chapters.filter(ch => ch >= 1 && ch <= total);
  }

  const skeletonDone = new Set(progress.skeleton.done);
  return Array.from({ length: total }, (_, i) => i + 1)
    .filter(ch => !done.has(ch) && (step === 'skeleton' || skeletonDone.has(ch)));
}

// 输出 JSON 结果供主 agent 使用
function output(data) {
  console.log(JSON.stringify(data, null, 2));
}

switch (config.step) {
  case 'status': {
    const progress = loadProgress();
    const skeletonPending = getChaptersToProcess('skeleton');
    const deepPending = getChaptersToProcess('deep');

    output({
      novelDir: config.novelDir,
      skeleton: {
        total: progress.skeleton.total,
        done: progress.skeleton.done.length,
        pending: skeletonPending.length,
        nextChapters: skeletonPending.slice(0, 5)
      },
      deep: {
        total: progress.deep.total,
        done: progress.deep.done.length,
        pending: deepPending.length,
        nextChapters: deepPending.slice(0, 5)
      },
      merge: progress.merge,
      nextStep: skeletonPending.length > 0 ? 'skeleton' :
                deepPending.length > 0 ? 'deep' :
                !progress.merge ? 'merge' : 'done',
      paths
    });
    break;
  }

  case 'skeleton': {
    const chapters = getChaptersToProcess('skeleton');
    const promptTemplate = fs.readFileSync(paths.skeletonPrompt, 'utf-8');

    const tasks = chapters.map(chNum => {
      const text = getChapterText(chNum);
      if (!text) return { chNum, error: '章节原文不存在' };

      return {
        chNum,
        charCount: text.length,
        prompt: `${promptTemplate}\n\n---\n\n## 第 ${chNum} 章原文\n\n${text}`,
        outputPath: path.join(paths.chaptersOutputDir, `ch_${String(chNum).padStart(2, '0')}_skeleton.json`)
      };
    });

    output({
      step: 'skeleton',
      totalTasks: tasks.length,
      tasks: tasks.filter(t => !t.error),
      errors: tasks.filter(t => t.error)
    });
    break;
  }

  case 'deep': {
    const chapters = getChaptersToProcess('deep');
    const promptTemplate = fs.readFileSync(paths.deepPrompt, 'utf-8');

    const tasks = chapters.map(chNum => {
      const text = getChapterText(chNum);
      if (!text) return { chNum, error: '章节原文不存在' };

      const skeleton = getSkeleton(chNum);
      if (!skeleton) return { chNum, error: '骨架数据不存在，请先完成骨架提取' };

      const skeletonIndex = formatSkeletonIndex(skeleton);

      return {
        chNum,
        charCount: text.length,
        skeletonChars: (skeleton.characters || []).length,
        skeletonSkills: (skeleton.skills || []).length,
        prompt: `${promptTemplate}\n\n---\n\n## 骨架索引\n\n${skeletonIndex}\n\n## 第 ${chNum} 章原文\n\n${text}`,
        outputPath: path.join(paths.chaptersOutputDir, `ch_${String(chNum).padStart(2, '0')}_deep.json`)
      };
    });

    output({
      step: 'deep',
      totalTasks: tasks.length,
      tasks: tasks.filter(t => !t.error),
      errors: tasks.filter(t => t.error)
    });
    break;
  }

  case 'update-progress': {
    const step = process.argv[4]; // skeleton or deep
    const chNum = parseInt(process.argv[5]);
    const progress = loadProgress();

    if (!progress[step].done.includes(chNum)) {
      progress[step].done.push(chNum);
      progress[step].done.sort((a, b) => a - b);
    }

    saveProgress(progress);
    output({ updated: true, step, chNum, done: progress[step].done.length });
    break;
  }

  case 'save-result': {
    const step = process.argv[4]; // skeleton or deep
    const chNum = parseInt(process.argv[5]);
    const jsonStr = process.argv[6]; // JSON string from sub-agent

    if (!jsonStr) {
      output({ error: '未提供 JSON 数据' });
      process.exit(1);
    }

    const padded = String(chNum).padStart(2, '0');
    const outputFile = path.join(paths.chaptersOutputDir, `ch_${padded}_${step}.json`);

    try {
      // 清理可能的 markdown 代码块标记
      let cleaned = jsonStr.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      const data = JSON.parse(cleaned);

      // 验证必要字段
      if (step === 'skeleton') {
        if (!data.characters || !data.factions || !data.locations || !data.skills) {
          output({ error: '骨架数据缺少必要字段' });
          process.exit(1);
        }
      }

      fs.mkdirSync(paths.chaptersOutputDir, { recursive: true });
      fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf-8');

      // 更新进度
      const progress = loadProgress();
      if (!progress[step].done.includes(chNum)) {
        progress[step].done.push(chNum);
        progress[step].done.sort((a, b) => a - b);
      }
      saveProgress(progress);

      output({ saved: true, file: outputFile, chNum, step });
    } catch (e) {
      output({ error: `JSON 解析失败: ${e.message}` });
      process.exit(1);
    }
    break;
  }

  default:
    output({ error: `未知步骤: ${config.step}` });
    process.exit(1);
}
