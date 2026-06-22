import type { Character, Faction } from '../../types/novel';

const RANK_ORDER = [
  '返璞归真', '登峰造极', '出神入化', '炉火纯青',
  '登堂入室', '略有小成', '初窥门径', '平平无奇',
];

export interface CharacterRow {
  id: string;
  name: string;
  alias: string[];
  role: string;
  rank: string;
  faction: string;
  factionName: string;
  summary: string;
}

export interface CharacterRowFilters {
  search: string;
  roles: string[];
  ranks: string[];
  factions: string[];
}

export function resolveFactionName(
  factionValue: string | null,
  factions: Array<Pick<Faction, 'id' | 'name'>>,
): string {
  if (!factionValue) return '无门派';
  const byId = factions.find(f => f.id === factionValue);
  if (byId) return byId.name;
  const byName = factions.find(f => f.name === factionValue);
  if (byName) return byName.name;
  return factionValue;
}

export function buildCharacterRows(
  characters: Character[],
  factions: Array<Pick<Faction, 'id' | 'name'>>,
  filters: CharacterRowFilters,
): CharacterRow[] {
  const q = filters.search.toLowerCase();
  let result = characters;

  if (q) {
    result = result.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.alias?.some(a => a.toLowerCase().includes(q)) ||
      c.identity?.toLowerCase().includes(q)
    );
  }
  if (filters.roles.length > 0) {
    result = result.filter(c => filters.roles.includes(c.role));
  }
  if (filters.ranks.length > 0) {
    result = result.filter(c => filters.ranks.includes(c.power_rank ?? c.rank));
  }
  if (filters.factions.length > 0) {
    result = result.filter(c => filters.factions.includes(c.faction || '_none'));
  }

  return [...result]
    .sort((a, b) => {
      const ai = RANK_ORDER.indexOf(a.power_rank ?? a.rank);
      const bi = RANK_ORDER.indexOf(b.power_rank ?? b.rank);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map(c => ({
      id: c.id,
      name: c.name,
      alias: c.alias || [],
      role: c.role,
      rank: c.power_rank ?? c.rank ?? '',
      faction: c.faction || '_none',
      factionName: resolveFactionName(c.faction, factions),
      summary: c.identity || c.one_line || '',
    }));
}
