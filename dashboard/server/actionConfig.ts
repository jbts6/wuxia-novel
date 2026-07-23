import type { GenerationStage, LibraryBookStatus, SuggestedAction } from '../src/types/library';

const PIPELINE_SCRIPT_ROOT = '.agents/skills/generate-kb/scripts';
const V7_SCRIPT_ROOT = '.agents/skills/generate-game-kb/scripts';

export interface ActionConfig {
  type: string;
  label: string;
  description: string;
  script: string | null;
  scriptRoot?: string;
  prefixArgs?: string[];
  extraArgs?: string[];
  includeValidationRunId?: boolean;
  triggerStage: GenerationStage | GenerationStage[];
  triggerCondition?: (status: LibraryBookStatus) => boolean;
}

export interface ActionInvocation {
  script: string;
  args: string[];
}

function usesGenerateKbContract(status: LibraryBookStatus): boolean {
  return status.validationContract === 'none'
    || status.validationContract === 'generate-kb-gates';
}

export const ACTION_CONFIGS: ActionConfig[] = [
  {
    type: 'split-chapters',
    label: '切分章节',
    description: '尚未发现有效的 ch_split 产物。',
    script: 'split-chapters.js',
    triggerStage: 'not-started',
  },
  {
    type: 'prepare-source',
    label: '生成来源索引与扫描清单',
    description: '切章已存在，但缺少可计数的 scan manifest。',
    script: 'prepare-source.js',
    triggerStage: 'prepared',
    triggerCondition: (status) => !status.artifacts.scanManifest,
  },
  {
    type: 'validate-inventory',
    label: '检查候选清单覆盖',
    description: '继续 generate-kb 的扫描或归并阶段，并用校验脚本检查剩余窗口和 ledger。',
    script: 'validate-inventory.js',
    triggerStage: ['scanning', 'pending-merge'],
  },
  {
    type: 'audit-recall',
    label: '检查独立查漏',
    description: 'named-inventory 与 event-dialogue 已完成，仍需完成独立 gap audit。',
    script: 'audit-recall.js',
    triggerStage: 'pending-gap',
  },
  {
    type: 'audit-recall-legacy',
    label: '诊断旧版知识库',
    description: '消费数据可浏览，但尚未经过新版 G1-G5 证明。',
    script: 'audit-recall.js',
    extraArgs: ['--legacy'],
    triggerStage: 'data-produced',
    triggerCondition: (status) =>
      usesGenerateKbContract(status)
      && status.validationStatus === 'legacy-unproven',
  },
  {
    type: 'assess-quality',
    label: '检查质量门禁',
    description: '数据已产出，但质量报告尚未证明 G1-G5 全部通过。',
    script: 'assess-quality.js',
    extraArgs: ['--report-only', '--dry-run'],
    triggerStage: 'data-produced',
    triggerCondition: (status) =>
      usesGenerateKbContract(status)
      && status.validationStatus !== 'passed',
  },
  {
    type: 'fill-content',
    label: '补全实体内容',
    description: '实体文件已经存在，但只有部分条目包含结构化详情。',
    script: null,
    triggerStage: 'data-produced',
    triggerCondition: (status) =>
      usesGenerateKbContract(status)
      && (status.contentCoverage.state === 'index-only'
        || status.contentCoverage.state === 'partial'),
  },
  {
    type: 'game-kb-status',
    label: '诊断 v7 安装状态',
    description: 'v7 安装验证未通过，需要检查安装状态。',
    script: 'flow.js',
    scriptRoot: V7_SCRIPT_ROOT,
    prefixArgs: ['status'],
    includeValidationRunId: true,
    triggerStage: 'data-produced',
    triggerCondition: (status) =>
      status.validationContract === 'generate-game-kb-v7'
      && status.validationStatus !== 'passed'
      && status.validationRunId !== null,
  },
];

export function findAction(status: LibraryBookStatus): ActionConfig | null {
  return ACTION_CONFIGS.find((config) => {
    const stageMatch = Array.isArray(config.triggerStage)
      ? config.triggerStage.includes(status.generationStage)
      : config.triggerStage === status.generationStage;
    const conditionMatch = config.triggerCondition
      ? config.triggerCondition(status)
      : true;
    return stageMatch && conditionMatch;
  }) ?? null;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function buildActionInvocation(
  actionType: string,
  bookPath: string,
  validationRunId: string | null = null,
): ActionInvocation | null {
  const config = ACTION_CONFIGS.find((candidate) => candidate.type === actionType);
  if (!config?.script) return null;
  if (config.includeValidationRunId && !validationRunId) return null;

  const args = [...(config.prefixArgs ?? []), bookPath, ...(config.extraArgs ?? [])];
  if (config.includeValidationRunId && validationRunId) {
    args.push('--run', validationRunId);
  }
  return {
    script: `${config.scriptRoot ?? PIPELINE_SCRIPT_ROOT}/${config.script}`,
    args,
  };
}

export function buildSuggestedAction(
  bookPath: string,
  status: LibraryBookStatus,
): SuggestedAction | null {
  const config = findAction(status);
  if (!config || !config.script) return null;
  const invocation = buildActionInvocation(config.type, bookPath, status.validationRunId);
  if (!invocation) return null;

  return {
    label: config.label,
    reason: config.description,
    command: `node ${shellQuote(invocation.script)} ${invocation.args.map(shellQuote).join(' ')}`,
    type: config.type,
  };
}
