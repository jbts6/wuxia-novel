export const ROLE_LABEL: Record<string, string> = {
  protagonist: '主角',
  companion: '同伴',
  villain: '反派',
  npc: '路人',
};

export const ARCHETYPE_LABEL: Record<string, string> = {
  warrior: '武者',
  scholar: '文士',
  monk: '僧道',
  assassin: '刺客',
  healer: '医者',
};

export function displayRole(value?: string | null): string | null {
  if (!value) return null;
  return ROLE_LABEL[value] ?? value;
}

export function displayArchetype(value?: string | null): string | null {
  if (!value) return null;
  return ARCHETYPE_LABEL[value] ?? value;
}

export function displayImportance(value?: string | null): string | null {
  if (!value || value === '未知') return null;
  return value;
}
