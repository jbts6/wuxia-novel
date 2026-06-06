const fs = require('fs');
const path = 'C:/git/wuxia-novel/梁羽生/武当一剑/dialogues.json';
const dialogues = JSON.parse(fs.readFileSync(path, 'utf8'));

const samples = [
  'null', 'char_wu_liang_daoren', 'char_unknown_youth', 'char_guo_tie_zheng',
  'char_lui_jian', 'char_zheng_tian_xiang', 'char_qi_xing_jian_ke',
  'hong_xiao', 'bao_yi_xu', 'du_cheng_lin', 'yuanzhen', 'yuanxing',
  'yuantong', 'liaofan', 'yuanye', 'tongchan_shangren', 'wu_dang_qi_tu',
  'char_lan_kao_shan_qi', 'zhong_jiu_sheng', 'zi_yu', 'yu_zhao_xing',
  'hike', '蓝母', '牟沧浪', 'wu_se',
  '郭东来', '耿玉京', '不波', '王晦闻', '众人', '陌生人',
  '无名真人', '窗外人', 'all', '唐仲山',
];

for (const s of samples) {
  const matches = dialogues.filter(d => d.speaker === s || d.listener === s);
  if (matches.length === 0) continue;
  console.log(`=== ${s} (${matches.length} total) ===`);
  matches.slice(0, 3).forEach(d => {
    const text = d.text || '';
    const trunc = text.length > 60 ? text.substring(0, 60) + '...' : text;
    console.log(`  ch${d.chapter} [${d.tone}] speaker=${d.speaker} listener=${d.listener} "${trunc}"`);
  });
}
