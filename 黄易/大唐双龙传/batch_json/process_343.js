const fs = require('fs');
const path = require('path');

const novelDir = '/Users/admin/Site/wuxia-novel/黄易/大唐双龙传';
const batchDir = path.join(novelDir, 'batch_json');

const md = fs.readFileSync(path.join(novelDir, 'ch_formatted/ch_343.md'), 'utf8');
const lines = md.split('\n');

const segments = [
  { segment: 1, line_start: 1, line_end: 93 },
  { segment: 2, line_start: 94, line_end: 186 },
  { segment: 3, line_start: 187, line_end: 279 },
];

// ---- Dialogue extraction ----
function collectQuoteTexts(lineStart, lineEnd) {
  const result = [];
  for (let i = lineStart - 1; i < lineEnd && i < lines.length; i++) {
    const line = lines[i];
    // Find opening quote after a speaker attribution pattern
    const speakerMatch = line.match(/([^，。；！？\n]{2,4})(?:道|说|问|答|骂|笑|叫|叹|喝|沉|低|提议|续下命令|接口|反驳|大笑|点头|摇头|点头|苦笑|平静地|淡淡道|低[^，。；！？]{0,4}道)/);
    const quoteStart = line.indexOf('"');
    if (quoteStart === -1) continue;

    // Extract what comes after the last speaker name before the quote
    let speaker = null;
    let speakerName = null;

    const knownSpeakers = [
      { name: '徐子陵', id: 'char_xu_zi_ling' },
      { name: '寇仲', id: 'char_kou_zhong' },
      { name: '突利', id: 'char_tu_li' },
      { name: '游秋雁', id: 'char_you_qiu_yuan' },
      { name: '祝玉妍', id: 'char_zhu_yu_yan' },
      { name: '辟守玄', id: 'char_pi_shou_xuan' },
      { name: '闻采婷', id: 'char_wen_cai_ting' },
      { name: '鸨婆', id: 'char_bao_po' },
      { name: '鹑婆', id: 'char_bao_po' },
      { name: '半婆', id: 'char_bao_po' },
    ];

    for (const sp of knownSpeakers) {
      const idx = line.lastIndexOf(sp.name);
      if (idx >= 0) {
        const after = line.slice(idx + sp.name.length);
        const speechVerbs = ['道', '说', '问', '答', '骂', '笑', '叫', '叹', '喝'];
        if (speechVerbs.some(v => after.startsWith(v))) {
          speaker = sp.id;
          speakerName = sp.name;
          break;
        }
      }
    }

    // Handle "陌生的男子口音道" -> this is 青衫中年男子
    if (!speaker && line.includes('陌生的男子口音道')) {
      speaker = 'char_qing_shan_zhong_nian_nan_zi';
      speakerName = '青衫中年男子';
    }

    if (!speaker) continue;

    // Determine tone
    let tone = '陈述';
    const toneIndicators = [
      { p: '苦笑', t: '苦笑' }, { p: '冷笑', t: '冷笑' }, { p: '微笑', t: '微笑' },
      { p: '大笑', t: '大笑' }, { p: '笑道', t: '微笑' },
      { p: '沉声', t: '沉声' }, { p: '低声道', t: '低语' }, { p: '低声', t: '低语' },
      { p: '平静地道', t: '淡然' }, { p: '平静地道', t: '淡然' }, { p: '淡淡道', t: '淡然' },
      { p: '得意洋洋的道', t: '得意' }, { p: '兴奋', t: '激动' },
      { p: '叹道', t: '无奈' }, { p: '叹', t: '无奈' },
      { p: '问道', t: '疑问' }, { p: '不解道', t: '疑问' },
      { p: '咋舌道', t: '惊讶' }, { p: '大喜道', t: '欣喜' },
      { p: '不服', t: '认真' }, { p: '反驳道', t: '认真' },
      { p: '接口道', t: '陈述' }, { p: '点头道', t: '陈述' },
      { p: '摇头道', t: '无奈' },
      { p: '提议道', t: '陈述' }, { p: '岔开话题道', t: '陈述' },
      { p: '眉飞色舞道', t: '得意' }, { p: '凑到他耳旁道', t: '低语' },
      { p: '环目一扫，道', t: '陈述' }, { p: '催促', t: '焦急' },
    ];
    for (const { p, t } of toneIndicators) {
      if (line.includes(p)) { tone = t; break; }
    }

    // Collect all quoted text from this line and following lines
    let fullText = '';
    let textLines = [];
    let foundStart = false;
    let foundEnd = false;

    for (let j = i; j < lineEnd && j < lines.length; j++) {
      const l = lines[j];
      const startQ = l.indexOf('"');
      const endQ = l.lastIndexOf('"');

      if (!foundStart && startQ >= 0) {
        foundStart = true;
        fullText = l.slice(startQ + 1);
        if (endQ > startQ) {
          // Both quotes on same line
          fullText = l.slice(startQ + 1, endQ);
          foundEnd = true;
          textLines.push(j);
          break;
        }
        textLines.push(j);
      } else if (foundStart && !foundEnd) {
        if (l.trim() === '"') {
          foundEnd = true;
          break;
        }
        const qPos = l.indexOf('"');
        if (qPos >= 0) {
          fullText += l.slice(0, qPos);
          foundEnd = true;
          break;
        }
        fullText += l;
        textLines.push(j);
      }
    }

    if (foundStart) {
      if (!foundEnd) {
        fullText = fullText.replace(/"$/, '');
      }
      fullText = fullText.trim().replace(/^"|"$/g, '').trim();
      if (fullText) {
        result.push({
          speaker, speakerName, tone,
          text: fullText,
          chapter: 343,
          line_start: i + 1,
          line_end: textLines.length > 0 ? textLines[textLines.length - 1] + 1 : i + 1,
          listener: null
        });
      }
    }
  }
  return result;
}

// ---- Build segment data ----
function buildSegment(segIdx) {
  const seg = segments[segIdx];
  const s = seg.line_start, e = seg.line_end;

  const base = { segment: seg.segment, line_start: s, line_end: e, dialogues: [], new_entities: { characters: [], skills: [], techniques: [], factions: [], locations: [], items: [] }, entity_updates: [] };

  base.dialogues = collectQuoteTexts(s, e);

  // ---- Segment 1: lines 1-93 ----
  if (segIdx === 0) {
    base.new_entities.characters.push(
      mkChar('char_tu_li', '突利', [], '突厥可汗，寇徐盟友', '突厥', 'companion', 'warrior', '出神入化', '突厥可汗，与寇仲徐子陵结盟，勇猛豪迈', ['豪迈', '直率', '坚毅', '好战', '敬佩'], '豪迈', '外向',
        [{ target: 'char_kou_zhong', type: '挚友', intensity: 80, bond_level: 4, dynamic: '并肩作战' }, { target: 'char_xu_zi_ling', type: '挚友', intensity: 80, bond_level: 4, dynamic: '并肩作战' }],
        [343], [{ chapter: 343, line_start: 11, line_end: 11, text: '突利道："现在至少证明小弟所料不差，游秋雁乃阴癸派遣来的奸细。' }]),
      mkChar('char_you_qiu_yuan', '游秋雁', ['秋雁'], '阴癸派奸细', '阴癸派', 'villain', 'assassin', '登堂入室', '阴癸派女弟子，被派作奸细接近寇徐', ['阴险', '狡猾', '反复', '无情', '隐忍'], '淡然', '阴冷',
        [{ target: 'char_kou_zhong', type: '宿敌', intensity: 70, bond_level: 2, dynamic: '寇仲曾两次放过她' }, { target: 'char_pi_shou_xuan', type: '主仆', intensity: 85, bond_level: 3, dynamic: '受其指使' }],
        [343], [{ chapter: 343, line_start: 11, line_end: 11, text: '游秋雁乃阴癸派遣来的奸细。' }]),
      mkChar('char_ji_yi_nong', '季亦农', [], '阳兴会首领', '阳兴会', 'npc', 'warrior', '登堂入室', '阳兴会首领，寇徐刺杀目标，受阴癸派保护', ['谨慎', '担心', '惜命', '精明', '多疑'], '陈述', '谨慎',
        [{ target: 'char_kou_zhong', type: '宿敌', intensity: 100, bond_level: 1, dynamic: '被追杀的猎物' }, { target: 'char_zhu_yu_yan', type: '主仆', intensity: 80, bond_level: 3, dynamic: '受阴癸派保护' }],
        [343], [{ chapter: 343, line_start: 15, line_end: 15, text: '取季亦农的狗命' }]),
      mkChar('char_zhu_yu_yan', '祝玉妍', ['祝妖妇', '阴后', '宗尊'], '阴癸派宗主', '阴癸派', 'villain', 'warrior', '登峰造极', '阴癸派宗主，武功高绝，诡计多端', ['阴狠', '狡诈', '果决', '威严', '精明'], '淡然', '阴沉',
        [{ target: 'char_kou_zhong', type: '宿敌', intensity: 95, bond_level: 2, dynamic: '欲夺杨公宝藏并杀之' }, { target: 'char_xu_zi_ling', type: '宿敌', intensity: 95, bond_level: 2, dynamic: '欲夺杨公宝藏并杀之' }, { target: 'char_pi_shou_xuan', type: '同门', intensity: 70, bond_level: 3, dynamic: '师叔侄关系' }, { target: 'char_wan_wan', type: '师徒', intensity: 90, bond_level: 5, dynamic: '信任有加' }],
        [343], [{ chapter: 343, line_start: 97, line_end: 97, text: '阴后祝玉妍' }]),
      mkChar('char_pi_shou_xuan', '辟守玄', ['云雨双修', '老辟', '辟师叔'], '阴癸派宿老', '阴癸派', 'villain', 'warrior', '出神入化', '阴癸派宿老，号云雨双修，以计谋见长', ['好色', '自负', '老谋深算', '阴险', '善谋'], '淡然', '阴沉',
        [{ target: 'char_zhu_yu_yan', type: '同门', intensity: 70, bond_level: 3, dynamic: '师叔侄关系' }, { target: 'char_you_qiu_yuan', type: '主仆', intensity: 85, bond_level: 3, dynamic: '指使其作奸细' }],
        [343], [{ chapter: 343, line_start: 97, line_end: 97, text: '"云雨双修"辟守玄' }]),
      mkChar('char_bian_bu_fu', '边不负', ['魔隐'], '阴癸派高手', '阴癸派', 'villain', 'assassin', '出神入化', '阴癸派高手，号魔隐，以诡异身法闻名', ['阴狠', '诡秘', '冷酷', '残忍', '高傲'], '冷酷', '阴沉',
        [{ target: 'char_zhu_yu_yan', type: '主仆', intensity: 80, bond_level: 3, dynamic: '下属' }],
        [343], [{ chapter: 343, line_start: 97, line_end: 97, text: '"魔隐"边不负' }]),
      mkChar('char_wen_cai_ting', '闻采婷', ['采婷'], '阴癸派女弟子', '阴癸派', 'villain', 'assassin', '登堂入室', '阴癸派女弟子，听命祝玉妍', ['阴险', '冷漠', '忠心', '果断', '无情'], '淡然', '阴冷',
        [{ target: 'char_zhu_yu_yan', type: '主仆', intensity: 90, bond_level: 4, dynamic: '忠心下属' }],
        [343], [{ chapter: 343, line_start: 97, line_end: 97, text: '闻采婷' }]),
      mkChar('char_wan_wan', '婠婠', ['涫儿'], '阴癸派女弟子', '阴癸派', 'villain', 'assassin', '出神入化', '阴癸派最得宠的女弟子，祝玉妍的心腹', ['聪慧', '狡黠', '心狠手辣', '莫测', '机敏'], '淡然', '阴冷',
        [{ target: 'char_zhu_yu_yan', type: '师徒', intensity: 95, bond_level: 5, dynamic: '最信任的弟子' }],
        [343], [{ chapter: 343, line_start: 97, line_end: 97, text: '却不见婠婠。' }]),
      mkChar('char_qing_shan_zhong_nian_nan_zi', '青衫中年男子', ['青衣中年'], '阴癸派相关人员', '阴癸派', 'npc', 'warrior', '登堂入室', '随祝玉妍一同出现的青衫中年男子，可能为季亦农', ['谨慎', '恭敬', '精明', '老练', '沉稳'], '陈述', '沉稳', [],
        [343], [{ chapter: 343, line_start: 97, line_end: 97, text: '一个身穿青衣的中年男子' }]),
    );
    base.new_entities.factions.push(
      mkFaction('faction_yin_gui_pai', '阴癸派', '武林门派', '未知', [], '邪派巨擘，以天魔大法闻名', [{ chapter: 343, line_start: 11, line_end: 11, text: '游秋雁乃阴癸派遣来的奸细' }]),
      mkFaction('faction_yang_xing_hui', '阳兴会', '帮派', '南阳', [], '季亦农统领的帮会', [{ chapter: 343, line_start: 203, line_end: 203, text: '季亦农的阳兴会手下' }]),
      mkFaction('faction_jing_shan_pai', '荆山派', '武林门派', '未知', [], '南阳当地武林门派', [{ chapter: 343, line_start: 129, line_end: 129, text: '荆山派' }]),
      mkFaction('faction_zhen_yang_pai', '镇阳派', '武林门派', '未知', [], '南阳当地武林门派', [{ chapter: 343, line_start: 129, line_end: 129, text: '镇阳派' }]),
    );
    base.new_entities.locations.push(
      mkLocation('loc_nan_yang', '南阳', '中原', '中原重镇，阴癸派高手云集之地', [{ chapter: 343, line_start: 9, line_end: 9, text: '阴癸派在南阳仍是高手云集' }]),
    );
    base.entity_updates.push(
      { id: 'char_kou_zhong', updates: { rag_refs: [343], source_refs: [{ chapter: 343, line_start: 15, line_end: 15, text: '寇仲胸有成竹的道' }] } },
      { id: 'char_xu_zi_ling', updates: { rag_refs: [343], source_refs: [{ chapter: 343, line_start: 3, line_end: 3, text: '徐子陵于院培落回地上' }] } },
    );
  }

  // ---- Segment 2: lines 94-186 ----
  if (segIdx === 1) {
    // No new entities in this segment
  }

  // ---- Segment 3: lines 187-279 ----
  if (segIdx === 2) {
    base.new_entities.characters.push(
      mkChar('char_bao_po', '鸨婆', ['鹑婆', '半婆'], '月兰舍老鸨', '月兰舍', 'npc', 'scholar', '平平无奇', '月兰舍鸨婆，贪财圆滑', ['贪财', '圆滑', '势利', '世故', '精明'], '奉承', '世故', [], [343], [{ chapter: 343, line_start: 211, line_end: 211, text: '鸨婆迎上来时' }]),
      mkChar('char_xiao_wan', '小宛', ['小宛姑娘'], '月兰舍青楼姑娘', '月兰舍', 'npc', 'scholar', '平平无奇', '月兰舍青楼姑娘，与天魁派谢显庭相好', ['温婉', '多情', '柔弱', '善良', '顺从'], '柔声', '温柔',
        [{ target: 'char_xie_xian_ting', type: '恋人', intensity: 80, bond_level: 4, dynamic: '与谢显庭相好' }], [343], [{ chapter: 343, line_start: 221, line_end: 221, text: '小宛正是与天魁派弟子谢显庭相好的青楼姑娘' }]),
      mkChar('char_xie_xian_ting', '谢显庭', ['谢公子', '谢魁'], '天魁派弟子', '天魁派', 'npc', 'warrior', '略有小成', '天魁派弟子，与小宛相好', ['多情', '年轻', '直率', '冲动', '侠义'], '陈述', '外向',
        [{ target: 'char_xiao_wan', type: '恋人', intensity: 80, bond_level: 4, dynamic: '相好' }], [343], [{ chapter: 343, line_start: 221, line_end: 221, text: '天魁派弟子谢显庭' }]),
    );
    base.new_entities.factions.push(
      mkFaction('faction_tian_kui_pai', '天魁派', '武林门派', '未知', [], '谢显庭所属门派', [{ chapter: 343, line_start: 221, line_end: 221, text: '天魁派弟子谢显庭' }]),
      mkFaction('faction_yue_lan_she', '月兰舍', '帮派', '南阳', [], '南阳烟花之地', [{ chapter: 343, line_start: 193, line_end: 193, text: '灯火通明的月兰舍' }]),
    );
    base.new_entities.locations.push(
      mkLocation('loc_yue_lan_she', '月兰舍', '南阳', '南阳的烟花之地，季亦农与人谈判之处', [{ chapter: 343, line_start: 193, line_end: 193, text: '灯火通明的月兰舍' }]),
    );
  }

  return base;
}

function mkChar(id, name, alias, identity, faction, role, archetype, rank, oneLine, traits, speechStyle, temperament, relationships, ragRefs, sourceRefs) {
  return { id, name, alias, identity, faction, role, archetype, rank, one_line: oneLine, personality: { traits, speech_style: speechStyle, temperament }, relationships, known_skills: [], related_skills: [], rag_refs: ragRefs, source_refs: sourceRefs };
}
function mkFaction(id, name, type, location, subDivisions, oneLine, sourceRefs) {
  return { id, name, type, location, sub_divisions: subDivisions, one_line: oneLine, source_refs: sourceRefs };
}
function mkLocation(id, name, region, oneLine, sourceRefs) {
  return { id, name, region, one_line: oneLine, source_refs: sourceRefs };
}

// Write progress file
const progressFile = path.join(batchDir, 'ch_343_progress.jsonl');
const progressLines = segments.map((seg, i) => JSON.stringify(buildSegment(i)));
fs.writeFileSync(progressFile, progressLines.join('\n') + '\n', 'utf8');
console.log('Written progress: ' + progressLines.length + ' segments');

// Write summary
const summary = `第343章 重施故技

寇仲、徐子陵与突利被阴癸派包围于南阳旅馆，徐子陵提议重施当年在扬州用过的故技——在墙上留言制造已逃离假象。游秋雁发现后召来祝玉妍、辟守玄、边不负、闻采婷等高手。祝玉妍识破计谋却未坚持搜索，令婠婠追杀二人。寇徐等祝玉妍离开后，决定趁季亦农在月兰舍与荆山派、镇阳派谈判时行刺。三人混入月兰舍，以谢显庭友人名义取得鸨婆信任，包下东二楼厢房谋划突袭，门外忽响敲门声令二人警觉。`;
fs.writeFileSync(path.join(batchDir, 'ch_343_summary.txt'), summary, 'utf8');
console.log('Written summary');
