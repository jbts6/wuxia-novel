import type { GenerationStage, LibraryBookStatus, ValidationStatus } from '../types/library';

export const GENERATION_STAGE_LABELS: Record<GenerationStage, string> = {
  'not-started': '未生成',
  prepared: '准备完成',
  scanning: '扫描中',
  'pending-merge': '待归并',
  'pending-gap': '待查漏',
  'data-produced': '数据已产出',
};

export const VALIDATION_STATUS_LABELS: Record<ValidationStatus, string> = {
  'not-validated': '未校验',
  'legacy-unproven': '待新版验证',
  failed: '校验失败',
  passed: 'G1-G5 通过',
};

export function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function scanCoverageText(book: LibraryBookStatus): string {
  const named = book.scanProgress['named-inventory'];
  const dialogue = book.scanProgress['event-dialogue'];
  const gap = book.scanProgress['gap-audit'];
  if (named.total === 0 && dialogue.total === 0 && gap.total === 0) return '-';
  return `实体 ${named.completed}/${named.total} · 对话 ${dialogue.completed}/${dialogue.total} · 查漏 ${gap.completed}/${gap.total}`;
}

export function isGenerationInProgress(book: LibraryBookStatus): boolean {
  return ['prepared', 'scanning', 'pending-merge', 'pending-gap'].includes(book.generationStage);
}
