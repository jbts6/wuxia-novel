#!/usr/bin/env node
// 骨架+深度提取助手：读取格式说明，供子 agent 参考
console.log(JSON.stringify({
  task: "extract-skeleton-deep",
  chapterDir: "金庸/天龙八部/ch_formatted",
  outputDir: "金庸/天龙八部/chapters",
  progressFile: "金庸/天龙八部/progress.json",
  skeletonPromptFile: "tools/extract/skeleton-prompt.md",
  deepPromptFile: "tools/extract/deep-prompt.md",
  instructions: [
    "Read skeleton-prompt.md for the extraction format",
    "Read deep-prompt.md for the deep extraction format",
    "For each chapter, read ch_XX.md, extract skeleton JSON with rag_refs, save to ch_XX_skeleton.json",
    "Then read skeleton JSON + chapter again, extract deep JSON, save to ch_XX_deep.json",
    "Update progress.json after each chapter"
  ]
}))