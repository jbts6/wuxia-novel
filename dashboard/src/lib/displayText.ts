import { toChineseDisplayText } from './resolveId';

const DISPLAY_VALUE_LABELS: Record<string, string> = {
  core: '核心',
  important: '重要',
  secondary: '次要',
  minor: '次要',
  cameo: '龙套',
  high: '高',
  medium: '中',
  low: '低',
  warrior: '武者',
  scholar: '文士',
  monk: '僧人',
  assassin: '刺客',
  healer: '医者',
  civilian: '平民',
  commoner: '平民',
  innocent: '平民',
  leader: '领袖',
  ruler: '君主',
  master: '高手',
  mentor: '师长',
  official: '官员',
  schemer: '谋士',
  tragic: '悲剧人物',
  npc: '普通人物',
  attack: '攻击',
  buff: '增益',
  combat: '战斗',
  combo: '连招',
  control: '控制',
  debuff: '减益',
  defense: '防御',
  heal: '治疗',
  movement: '身法',
  special: '特殊',
  common: '普通',
  uncommon: '少见',
  rare: '稀有',
  epic: '珍稀',
  legendary: '传说',
  friend: '朋友',
  ally: '盟友',
  enemy: '敌对',
  rival: '对手',
  lover: '恋人',
  family: '亲属',
  disciple: '弟子',
  unknown: '未注明',
};

export function displayTaxonomyValue(
  value: string | null | undefined,
  fallback = '未注明',
): string {
  const text = value?.trim();
  if (!text) return fallback;
  return DISPLAY_VALUE_LABELS[text.toLocaleLowerCase('en-US')]
    ?? toChineseDisplayText(text)
    ?? fallback;
}

export function displayChineseValues(values: string[] | null | undefined): string[] {
  if (!values) return [];
  return [...new Set(values.flatMap((value) => {
    const displayValue = toChineseDisplayText(value);
    return displayValue ? [displayValue] : [];
  }))];
}
