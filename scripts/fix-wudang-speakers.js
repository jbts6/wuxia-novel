const fs = require('fs');
const base = 'C:/git/wuxia-novel/梁羽生/武当一剑';

const dialogues = JSON.parse(fs.readFileSync(`${base}/dialogues.json`, 'utf8'));
const chars = JSON.parse(fs.readFileSync(`${base}/characters.json`, 'utf8'));
const registry = JSON.parse(fs.readFileSync(`${base}/entity_registry.json`, 'utf8'));

const charIds = new Set(chars.map(c => c.id));

const speakerMap = {
  'char_wu_liang_daoren': 'char_wu_liang',
  'char_unknown_youth': 'char_unknown_youth',
  'lan_shui_ling': 'char_lan_shui_ling',
  'dong_fang_liang': 'char_dong_fang_liang',
  'xi_men_yan': 'char_xi_men_yan',
  'char_wu_se_daoren': 'char_wu_se',
  'tang_zhong_shan': 'char_tang_er_gong_zi',
  'chang_wu_niang': 'char_chang_wu_niang',
  'xi_men_fu_ren': 'char_xi_men_fu_ren',
  'hike': 'char_hui_ke',
  'char_guo_tie_zheng': 'char_guo_tie_zheng',
  'lan_yu_jing': 'char_lan_yu_jing',
  'null': 'char_narrator',
  '不岐（假冒）': 'char_bu_qi',
  'benwu_dashi': 'char_ben_wu_dashi',
  'char_lan_kao_shan_qi': 'char_lan_kao_shan',
  'char_lui_jian': 'char_lui_jian',
  'tongchan_shangren': 'char_tongchan_shangren',
  'char_qi_xing_jian_ke': 'char_guo_dong_lai',
  'wu_dang_qi_tu': 'char_wu_dang_qi_tu',
  'hong_xiao': 'char_hong_xiao',
  'bao_yi_xu': 'char_bao_yi_xu',
  'du_cheng_lin': 'char_du_cheng_lin',
  'yuanzhen': 'char_yuanzhen',
  'yuanxing': 'char_yuanxing',
  '常五娘（假冒）': 'char_chang_wu_niang',
  'char_unknown_elderly': 'char_unknown_elderly',
  'wu_se': 'char_wu_se',
  'mou_yi_yu': 'char_mou_yi_yu',
  'zhong_jiu_sheng': 'char_zhong_jiu_sheng',
  'zi_yu': 'char_zi_yu',
  'yu_zhao_xing': 'char_yu_zhao_xing',
  'yuantong': 'char_yuantong',
  'liaofan': 'char_liaofan',
  'yuanye': 'char_yuanye',
  'char_zheng_tian_xiang': 'char_zheng_tian_xiang',
  '蓝母': 'char_lan_mu',
  '牟沧浪': 'char_wu_ming',
  '郭东来': 'char_guo_dong_lai',
  '耿玉京': 'char_geng_yu_jing',
  '不波': 'char_bu_bo',
  '王晦闻': 'char_wang_hui_wen',
  '众人': 'char_zhong_ren',
  '陌生人': 'char_unknown_stranger',
  '无色道人': 'char_wu_se',
  '无名真人': 'char_wu_ming',
  'all': 'char_zhong_ren',
  '唐仲山': 'char_tang_er_gong_zi',
  '窗外人': 'char_unknown_outside_voice',
};

const newCharSpecs = {
  'char_unknown_youth': { name: '不明少年', identity: '身份不明的少年剑客', faction: 'null', role: 'npc', archetype: 'warrior', rank: '未知', one_line: '身份不明的少年', traits: ['神秘', '年轻', '剑术不凡', '谨慎', '警觉'] },
  'char_unknown_elderly': { name: '不明老者', identity: '身份不明的长者', faction: 'null', role: 'npc', archetype: 'warrior', rank: '未知', one_line: '身份不明的年长者', traits: ['神秘', '年迈', '沉稳', '世故', '深藏不露'] },
  'char_guo_tie_zheng': { name: '郭铁铮', identity: '朝廷武官/七星剑客之一', faction: 'null', role: 'companion', archetype: 'warrior', rank: '一流高手', one_line: '七星剑客之一，曾败于向天明', traits: ['刚直', '勇猛', '重义', '急性子', '不服输'] },
  'char_lui_jian': { name: '吕剑', identity: '慧可的武当故交', faction: 'null', role: 'npc', archetype: 'warrior', rank: '未知', one_line: '与慧可交手的武当门人', traits: ['谨慎', '好胜', '寡言', '好武', '机警'] },
  'char_tongchan_shangren': { name: '铜禅上人', identity: '少林罗汉堂首座', faction: 'faction_shao_lin', role: 'npc', archetype: 'monk', rank: '一流高手', one_line: '少林罗汉堂首座，本无大师师弟', traits: ['沉稳', '武艺高强', '忠诚', '寡言', '严谨'] },
  'char_wu_dang_qi_tu': { name: '武当七徒', identity: '武当派七名弟子之群体', faction: 'faction_wu_dang', role: 'npc', archetype: 'warrior', rank: '二流', one_line: '武当派七名弟子组成的群体', traits: ['集体行动', '忠诚', '听从号令', '团结', '年轻'] },
  'char_hong_xiao': { name: '红箫', identity: '西门家侍女', faction: 'null', role: 'npc', archetype: 'warrior', rank: '三流', one_line: '西门夫人的贴身侍女', traits: ['机警', '忠诚', '细心', '勇敢', '护主'] },
  'char_bao_yi_xu': { name: '包一虚', identity: '绿林盗匪', faction: 'null', role: 'villain', archetype: 'warrior', rank: '三流', one_line: '截拦西门夫人的盗匪', traits: ['粗鲁', '贪婪', '鲁莽', '凶狠', '无礼'] },
  'char_du_cheng_lin': { name: '杜承林', identity: '绿林盗匪头目', faction: 'null', role: 'villain', archetype: 'warrior', rank: '三流', one_line: '截拦西门夫人的盗匪头目', traits: ['凶悍', '鲁莽', '霸道', '自大', '愚蠢'] },
  'char_yuanzhen': { name: '圆真', identity: '少林弟子', faction: 'faction_shao_lin', role: 'npc', archetype: 'monk', rank: '三流', one_line: '少林僧人，慧可师侄', traits: ['恭敬', '勤快', '机警', '年轻', '谨慎'] },
  'char_yuanxing': { name: '圆性', identity: '少林弟子', faction: 'faction_shao_lin', role: 'npc', archetype: 'monk', rank: '三流', one_line: '少林僧人，圆业师弟', traits: ['谨慎', '机警', '恭敬', '年轻', '机敏'] },
  'char_yuantong': { name: '圆通', identity: '少林弟子', faction: 'faction_shao_lin', role: 'npc', archetype: 'monk', rank: '三流', one_line: '少林僧人', traits: ['恭敬', '机警', '年轻', '机敏', '谨慎'] },
  'char_liaofan': { name: '了凡', identity: '少林弟子', faction: 'faction_shao_lin', role: 'npc', archetype: 'monk', rank: '三流', one_line: '少林僧人，受方丈召见', traits: ['恭敬', '沉稳', '寡言', '守规矩', '谨慎'] },
  'char_yuanye': { name: '圆业', identity: '少林弟子', faction: 'faction_shao_lin', role: 'npc', archetype: 'monk', rank: '三流', one_line: '少林僧人，圆性师兄', traits: ['机警', '谨慎', '恭敬', '年轻', '敏慧'] },
  'char_zheng_tian_xiang': { name: '郑添祥', identity: '江湖义士', faction: 'null', role: 'npc', archetype: 'warrior', rank: '二流', one_line: '与西门燕相识的江湖义士', traits: ['正直', '义气', '豪迈', '率真', '豪爽'] },
  'char_lan_mu': { name: '蓝母', identity: '蓝靠山之妻', faction: 'null', role: 'npc', archetype: 'healer', rank: '常人', one_line: '蓝靠山的妻子', traits: ['慈爱', '忧心', '坚韧', '护犊', '朴实'] },
  'char_geng_yu_jing': { name: '耿玉京', identity: '不岐唯一弟子', faction: 'faction_wu_dang', role: 'protagonist', archetype: 'warrior', rank: '一流高手', one_line: '不岐的弟子，戈振军遗孤，习得武当剑法', traits: ['正直', '重情', '机警', '聪慧', '孝顺'] },
  'char_wang_hui_wen': { name: '王晦闻', identity: '七星剑客之一', faction: 'null', role: 'villain', archetype: 'warrior', rank: '一流高手', one_line: '七星剑客之一，追逐名利', traits: ['贪婪', '嫉妒', '追逐名利', '自私', '堕落'] },
  'char_zhong_ren': { name: '众人', identity: '在场群体听众', faction: 'null', role: 'npc', archetype: 'scholar', rank: '常人', one_line: '代表在场所有听众的群体代称', traits: ['群体', '共同反应', '旁听', '集体', '众人'] },
  'char_unknown_stranger': { name: '陌生人', identity: '未露面的陌生人', faction: 'null', role: 'npc', archetype: 'warrior', rank: '未知', one_line: '未表明身份的陌生人', traits: ['神秘', '未知', '隐藏身份', '警觉', '谨慎'] },
  'char_unknown_outside_voice': { name: '窗外人', identity: '窗外未露面的声音', faction: 'null', role: 'npc', archetype: 'warrior', rank: '未知', one_line: '在窗外未露面的对话者', traits: ['神秘', '隐藏', '暗中行事', '警觉', '谨慎'] },
  'char_narrator': { name: '叙述者', identity: '旁白/叙述视角', faction: 'null', role: 'npc', archetype: 'scholar', rank: '常人', one_line: '承接叙述视角的对话占位', traits: ['客观', '中性', '旁观', '记录', '叙述'] },
};

const fixedSpeakers = new Set();
const fixedListeners = new Set();
let speakerChanges = 0;
let listenerChanges = 0;

dialogues.forEach(d => {
  if (speakerMap[d.speaker] !== undefined && speakerMap[d.speaker] !== d.speaker) {
    d.speaker = speakerMap[d.speaker];
    speakerChanges++;
    fixedSpeakers.add(d.speaker);
  } else if (speakerMap[d.speaker] === d.speaker) {
    fixedSpeakers.add(d.speaker);
  }
  if (d.listener && speakerMap[d.listener] !== undefined && speakerMap[d.listener] !== d.listener) {
    d.listener = speakerMap[d.listener];
    listenerChanges++;
    fixedListeners.add(d.listener);
  } else if (d.listener && speakerMap[d.listener] === d.listener) {
    fixedListeners.add(d.listener);
  }
});

const neededIds = new Set([...fixedSpeakers, ...fixedListeners]);
const newChars = [];
for (const [id, spec] of Object.entries(newCharSpecs)) {
  if (!neededIds.has(id)) continue;
  if (charIds.has(id)) continue;
  newChars.push({
    id,
    name: spec.name,
    alias: [],
    identity: spec.identity,
    faction: spec.faction === 'null' ? null : spec.faction,
    role: spec.role,
    archetype: spec.archetype,
    rank: spec.rank,
    one_line: spec.one_line,
    personality: {
      traits: spec.traits,
      speech_style: '待补全',
      temperament: '待补全',
    },
    relationships: [],
    known_skills: [],
    related_skills: [],
    rag_refs: [],
    source_refs: [],
  });
  if (registry.characters) {
    registry.characters.push(newChars[newChars.length - 1]);
  }
}

const allChars = chars.concat(newChars);
const stillBad = {};
dialogues.forEach(d => {
  if (!allChars.find(c => c.id === d.speaker)) {
    stillBad[d.speaker] = (stillBad[d.speaker] || 0) + 1;
  }
  if (d.listener && !allChars.find(c => c.id === d.listener)) {
    stillBad[d.listener] = (stillBad[d.listener] || 0) + 1;
  }
});

console.log('=== 修复结果 ===');
console.log('Speaker 修复:', speakerChanges);
console.log('Listener 修复:', listenerChanges);
console.log('新增 char:', newChars.map(c => c.id).join(', '));
console.log('剩余未修复:', Object.keys(stillBad).length === 0 ? '无' : '');
Object.entries(stillBad).forEach(([k, v]) => console.log('  ' + v + '\t' + JSON.stringify(k)));

fs.writeFileSync(`${base}/dialogues.json`, JSON.stringify(dialogues, null, 2), 'utf8');
fs.writeFileSync(`${base}/characters.json`, JSON.stringify(allChars, null, 2), 'utf8');
fs.writeFileSync(`${base}/entity_registry.json`, JSON.stringify(registry, null, 2), 'utf8');
console.log('\n已保存 dialogues.json, characters.json, entity_registry.json');
