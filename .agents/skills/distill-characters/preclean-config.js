'use strict';

const ROLE_ENUM = ['核心', '重要', '次要', '龙套', '背景'];

const ROLE_MAP = {
  // 不做模糊映射，只处理明确的
};

/**
 * characters 预清洗配置
 */
module.exports = {
  fileKind: 'characters',
  companions: [],

  enums: {
    role: { values: ROLE_ENUM, map: ROLE_MAP },
  },

  /**
   * @param {Array} data - characters 数组
   * @param {Object} companions - { characters, skills, ... }
   * @param {Object} context - { companionFiles, novelDir }
   * @returns {{ data, changes, pending, deletedCount, companionWrites }}
   */
  sanitize(data, companions, context) {
    if (!Array.isArray(data)) return { data, changes: [], pending: [], deletedCount: 0 };

    const changes = [];
    const pending = [];
    let deletedCount = 0;

    // 1. role 枚举归一
    for (const char of data) {
      if (char.role && !ROLE_ENUM.includes(char.role)) {
        const mapped = ROLE_MAP[char.role];
        if (mapped) {
          changes.push({ id: char.id, field: 'role', before: char.role, after: mapped, rule: 'character.role_map', confidence: 'high' });
          char.role = mapped;
        } else {
          pending.push({ id: char.id, reason: 'role_not_in_enum', value: char.role });
        }
      }
    }

    // 2. relationships.target 引用修复（指向被合并的 id）
    const validIds = new Set(data.map(c => c.id));
    for (const char of data) {
      if (!Array.isArray(char.relationships)) continue;
      for (const rel of char.relationships) {
        if (rel.target && !validIds.has(rel.target)) {
          pending.push({ id: char.id, reason: 'invalid_relationship_target', value: rel.target });
        }
      }
    }

    return { data, changes, pending, deletedCount };
  },
};
