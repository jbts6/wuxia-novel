#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DRY_RUN = process.argv.includes('--dry-run');

const warnings = [];
function warn(msg) { warnings.push(msg); }

// ─── Helpers ───

function walkBooks(dir) {
  const books = [];
  for (const author of fs.readdirSync(dir)) {
    const authorDir = path.join(dir, author);
    if (!fs.statSync(authorDir).isDirectory() || author.startsWith('.')) continue;
    for (const book of fs.readdirSync(authorDir)) {
      const bookDir = path.join(authorDir, book);
      if (!fs.statSync(bookDir).isDirectory() || book.startsWith('.')) continue;
      books.push(bookDir);
    }
  }
  return books;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  if (!DRY_RUN) fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function fileExists(p) { try { fs.statSync(p); return true; } catch { return false; } }

// ─── Load all book data into memory ───

function loadBooks(books) {
  return books.map((dir) => {
    const skillPath = path.join(dir, 'skills.json');
    const charPath = path.join(dir, 'characters.json');
    const itemPath = path.join(dir, 'items.json');
    const factionPath = path.join(dir, 'factions.json');
    return {
      dir,
      skills: fileExists(skillPath) ? readJson(skillPath) : null,
      characters: fileExists(charPath) ? readJson(charPath) : null,
      items: fileExists(itemPath) ? readJson(itemPath) : null,
      factions: fileExists(factionPath) ? readJson(factionPath) : null,
    };
  });
}

// ─── Step 1: 删除冗余字段 ───

function step1(loaded) {
  let count = 0;
  for (const b of loaded) {
    if (b.skills) {
      let c = false;
      for (const s of b.skills) { if ('rank' in s) { delete s.rank; c = true; } }
      if (c) count++;
    }
    if (b.items) {
      let c = false;
      for (const i of b.items) { if ('rarity' in i) { delete i.rarity; c = true; } }
      if (c) count++;
    }
  }
  console.log(`Step 1: 删除冗余字段 — ${count} files`);
}

// ─── Step 2: 空值统一 ───

const FACTION_EMPTY = new Set(['', '无', '未知', '无门派', '不明', '无明确门派', '无所属', 'none', 'unknown', 'faction_none']);

function normFaction(v) {
  if (v == null) return null;
  return FACTION_EMPTY.has(v) ? null : v;
}

function step2(loaded) {
  let count = 0;
  for (const b of loaded) {
    for (const arr of [b.skills, b.characters]) {
      if (!arr) continue;
      let c = false;
      for (const e of arr) {
        const n = normFaction(e.faction);
        if (n !== e.faction) { e.faction = n; c = true; }
      }
      if (c) count++;
    }
  }
  console.log(`Step 2: 空值统一 — ${count} files`);
}

// ─── Step 3: Faction 标准化 ───

function buildFactionMap(loaded) {
  const map = new Map();
  for (const b of loaded) {
    if (!b.factions) continue;
    for (const f of b.factions) {
      if (f.id && f.name && !map.has(f.id)) map.set(f.id, f.name);
    }
  }
  return map;
}

function step3(loaded) {
  const fmap = buildFactionMap(loaded);
  let count = 0;
  for (const b of loaded) {
    for (const arr of [b.skills, b.characters]) {
      if (!arr) continue;
      let c = false;
      for (const e of arr) {
        if (e.faction == null) continue;
        const v = e.faction;
        if (v.startsWith('faction_')) {
          const name = fmap.get(v);
          if (name) { e.faction = name; c = true; }
          else { warn(`${e.name}: unmapped faction "${v}"`); }
        } else if (v.startsWith('loc_') || v.startsWith('char_')) {
          e.faction = null; c = true;
          warn(`${e.name}: cross-entity leak "${v}" → null`);
        }
      }
      if (c) count++;
    }
  }
  console.log(`Step 3: Faction 标准化 — ${count} files`);
}

// ─── Step 4: Skill type 标准化 ───

const SKILL_TYPE = {
  external: '外功', special: '特殊', skill: '武技', weapon: '兵器',
  attack: '攻击', internal: '内功', unarmed: '拳法', weapon_art: '兵器',
  martial_art: '武技', hidden_weapon: '暗器', finger: '指法', qinggong: '轻功',
  pill: '丹药', movement: '轻功', poison: '毒术', formation: '阵法', medical: '医术',
};

function step4(loaded) {
  let count = 0;
  for (const b of loaded) {
    if (!b.skills) continue;
    let c = false;
    for (const s of b.skills) {
      if (s.type && SKILL_TYPE[s.type]) { s.type = SKILL_TYPE[s.type]; c = true; }
    }
    if (c) count++;
  }
  console.log(`Step 4: Skill type 标准化 — ${count} files`);
}

// ─── Step 5: Item type 标准化 ───

const ITEM_TYPE = {
  special: '特殊', weapon: '兵器', hidden_weapon: '暗器', poison: '毒药',
  pill: '丹药', armor: '防具', 兵器: '兵器', 暗器: '暗器', 药物: '丹药',
  兵刃: '兵器', 食物: '食物', 信物: '信物', food: '食物', money_note: '票据',
};

function step5(loaded) {
  let count = 0;
  for (const b of loaded) {
    if (!b.items) continue;
    let c = false;
    for (const i of b.items) {
      if (i.type && ITEM_TYPE[i.type]) { i.type = ITEM_TYPE[i.type]; c = true; }
    }
    if (c) count++;
  }
  console.log(`Step 5: Item type 标准化 — ${count} files`);
}

// ─── Step 6: Character role 标准化 → 中文 ───

const ROLE_MAP = {
  protagonist: '主角', companion: '同伴', villain: '反派', npc: '路人',
  antagonist: '反派', supporting: '路人', support: '路人', supporter: '路人',
  supporting_character: '路人', minor: '路人', 配角: '路人',
};

function step6(loaded) {
  let count = 0;
  for (const b of loaded) {
    if (!b.characters) continue;
    let c = false;
    for (const ch of b.characters) {
      const r = ch.role;
      if (!r) { ch.role = '路人'; c = true; continue; }
      const mapped = ROLE_MAP[r];
      if (mapped) {
        if (mapped !== r) { ch.role = mapped; c = true; }
      } else if (r.length > 6) {
        if (!ch.one_line) ch.one_line = r;
        ch.role = '路人'; c = true;
      } else {
        ch.role = '路人'; c = true;
      }
    }
    if (c) count++;
  }
  console.log(`Step 6: Character role 标准化 — ${count} files`);
}

// ─── Step 7: Character archetype 标准化 → 中文 ───

const ARCHETYPE_MAP = {
  warrior: '武者', scholar: '文士', monk: '僧道', assassin: '刺客', healer: '医者',
  江湖人物: '武者', commoner: '武者', npc: '武者',
  神秘高手: '武者', 剑道名家: '武者', 剑客: '武者',
  少林高僧: '僧道', 僧人: '僧道', 道士: '僧道', 道人: '僧道',
  神医: '医者', 医者: '医者',
  杀手: '刺客', 刺客: '刺客',
  书生: '文士', 文人: '文士',
};

function step7(loaded) {
  let count = 0;
  for (const b of loaded) {
    if (!b.characters) continue;
    let c = false;
    for (const ch of b.characters) {
      const a = ch.archetype;
      if (!a) { ch.archetype = '武者'; c = true; continue; }
      const mapped = ARCHETYPE_MAP[a];
      if (mapped) {
        if (mapped !== a) { ch.archetype = mapped; c = true; }
      } else if (a.length > 6) {
        ch.archetype = '武者'; c = true;
      }
    }
    if (c) count++;
  }
  console.log(`Step 7: Character archetype 标准化 — ${count} files`);
}

// ─── Step 8: 修复 relationship 空 target ───

function step8(loaded) {
  let count = 0;
  for (const b of loaded) {
    if (!b.characters) continue;
    let c = false;
    for (const ch of b.characters) {
      if (!Array.isArray(ch.relationships)) continue;
      const before = ch.relationships.length;
      ch.relationships = ch.relationships.filter((r) => r.target);
      if (ch.relationships.length !== before) c = true;
    }
    if (c) count++;
  }
  console.log(`Step 8: 修复 relationship 空 target — ${count} files`);
}

// ─── Step 9: effects schema 统一 ───

function step9(loaded) {
  let count = 0;
  for (const b of loaded) {
    if (!b.items) continue;
    let c = false;
    for (const i of b.items) {
      if (!Array.isArray(i.effects) || i.effects.length === 0) continue;
      if (typeof i.effects[0] === 'string') {
        i.effects = i.effects.map((e) => ({ type: '效果', description: e }));
        c = true;
      }
    }
    if (c) count++;
  }
  console.log(`Step 9: effects schema 统一 — ${count} files`);
}

// ─── Step 10: alias 字段统一 ───

function step10(loaded) {
  let count = 0;
  for (const b of loaded) {
    if (!b.characters) continue;
    let c = false;
    for (const ch of b.characters) {
      if (!Array.isArray(ch.alias)) { ch.alias = []; c = true; }
    }
    if (c) count++;
  }
  console.log(`Step 10: alias 字段统一 — ${count} files`);
}

// ─── Write back ───

function writeBack(loaded) {
  let count = 0;
  for (const b of loaded) {
    if (b.skills) { writeJson(path.join(b.dir, 'skills.json'), b.skills); count++; }
    if (b.characters) { writeJson(path.join(b.dir, 'characters.json'), b.characters); count++; }
    if (b.items) { writeJson(path.join(b.dir, 'items.json'), b.items); count++; }
  }
  console.log(`\n写入: ${count} files`);
}

// ─── Main ───

console.log(`\n=== 数据清理${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);

const books = walkBooks(ROOT);
console.log(`扫描到 ${books.length} 本书\n`);

const loaded = loadBooks(books);

step1(loaded);
step2(loaded);
step3(loaded);
step4(loaded);
step5(loaded);
step6(loaded);
step7(loaded);
step8(loaded);
step9(loaded);
step10(loaded);

writeBack(loaded);

console.log(`\n=== 完成 ===`);
if (warnings.length > 0) {
  console.log(`\n警告 (${warnings.length}):`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}
