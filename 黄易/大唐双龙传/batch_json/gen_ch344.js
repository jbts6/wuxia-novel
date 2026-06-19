const fs = require('fs');
const path = require('path');

const batchDir = '/Users/admin/Site/wuxia-novel/黄易/大唐双龙传/batch_json';
const progressFile = path.join(batchDir, 'ch_344_progress.jsonl');

// ===== Segment 1: lines 1-101 =====
const seg1 = {
  segment: 1,
  line_start: 1,
  line_end: 101,
  dialogues: [
    { speaker: "char_yun_shuai", speaker_name: "云帅", listener: "char_kou_zhong", text: "少帅这是聪明一世，愚蠢一时，假若你们离城后立即远扬，怎会陷入现今绝境？", tone: "无奈", chapter: 344, line_start: 3, line_end: 5 },
    { speaker: "char_kou_zhong", speaker_name: "寇仲", listener: "char_yun_shuai", text: "国师可否说得清楚一点。", tone: "陈述", chapter: 344, line_start: 9, line_end: 11 },
    { speaker: "char_yun_shuai", speaker_name: "云帅", listener: "char_kou_zhong", text: "两个时辰前，少帅重返甫阳，意图行刺季亦农的消息不迳而走，本人初时并不相信，直至刚才亲眼目睹少帅进入青楼，才知少帅的行动全在别人算中。", tone: "陈述", chapter: 344, line_start: 13, line_end: 15 },
    { speaker: "char_xu_zi_ling", speaker_name: "徐子陵", listener: "char_yun_shuai", text: "国师说得不错，李元吉和康鞘利的人已把此处重重围困，季亦农当然没有出现，我们中了祝玉妍借刀杀人之计。", tone: "陈述", chapter: 344, line_start: 17, line_end: 19 },
    { speaker: "char_kou_zhong", speaker_name: "寇仲", listener: null, text: "好妖妇！果然厉害。", tone: "愤怒", chapter: 344, line_start: 21, line_end: 21 },
    { speaker: "char_kou_zhong", speaker_name: "寇仲", listener: "char_yun_shuai", text: "多谢国师指点，我们是中了祝妖妇的奸计，其中过程不提也罢。在下只想知道国师对我们要探取的是甚么态度和立场。", tone: "豪迈", chapter: 344, line_start: 43, line_end: 46 },
    { speaker: "char_yun_shuai", speaker_name: "云帅", listener: "char_kou_zhong", text: "若在两个时辰前，少帅向本人问同一句话，我会有完全不同的答案。", tone: "淡然", chapter: 344, line_start: 48, line_end: 50 },
    { speaker: "char_yun_shuai", speaker_name: "云帅", listener: "char_tu_li", text: "康鞘利因何会与李元吉联手来对付可汗？", tone: "疑问", chapter: 344, line_start: 52, line_end: 53 },
    { speaker: "char_tu_li", speaker_name: "突利", listener: "char_yun_shuai", text: "整件事包括国师刻下坐在这里，均是颉利和赵德言作的安排，要先借国师的手来杀我突利，再集中全力对付国师。穿针引线的是安隆，他和赵德言一直暗中勾结，国师想想便会明白。", tone: "沉声", chapter: 344, line_start: 57, line_end: 61 },
    { speaker: "char_yun_shuai", speaker_name: "云帅", listener: null, text: "三位好自为之。", tone: "微笑", chapter: 344, line_start: 71, line_end: 71 },
    { speaker: "char_tu_li", speaker_name: "突利", listener: null, text: "杀将出去如何？", tone: "冷笑", chapter: 344, line_start: 77, line_end: 77 },
    { speaker: "char_kou_zhong", speaker_name: "寇仲", listener: "char_li_yuan_ji", text: "手下败将李元吉，可敢和我寇仲再战一场。", tone: "豪迈", chapter: 344, line_start: 79, line_end: 81 },
    { speaker: "char_li_yuan_ji", speaker_name: "李元吉", listener: "char_kou_zhong", text: "谁是你的手下败将，你三人已是穷途末路，若肯下跪求饶，本王保证给你们一个痛快。", tone: "愤怒", chapter: 344, line_start: 91, line_end: 93 },
    { speaker: "char_mei_xun", speaker_name: "梅洵", listener: "char_kou_zhong", text: "在下南海派梅洵，寇少帅这么有兴致，不如先跟在下玩一场如何？", tone: "调侃", chapter: 344, line_start: 95, line_end: 97 },
    { speaker: "char_kou_zhong", speaker_name: "寇仲", listener: null, text: "看！一句话就试出敌人最强的一点，死地乃生门，我们出去！", tone: "得意", chapter: 344, line_start: 99, line_end: 101 },
  ],
  new_entities: { characters: [], skills: [], techniques: [], factions: [], locations: [], items: [] },
  entity_updates: [
    { id: "char_yun_shuai", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 3, line_end: 5, text: "云帅摇头叹道：少帅这是聪明一世，愚蠢一时，假若你们离城后立即远扬，怎会陷入现今绝境？" }] } },
    { id: "char_kou_zhong", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 9, line_end: 11, text: "寇仲道：国师可否说得清楚一点。" }] } },
    { id: "char_xu_zi_ling", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 17, line_end: 19, text: "徐子陵道：国师说得不错，李元吉和康鞘利的人已把此处重重围困，季亦农当然没有出现，我们中了祝玉妍借刀杀人之计。" }] } },
    { id: "char_tu_li", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 57, line_end: 61, text: "突利沉声道：整件事包括国师刻下坐在这里，均是颉利和赵德言作的安排" }] } },
    { id: "char_li_yuan_ji", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 91, line_end: 93, text: "李元吉怒道：谁是你的手下败将，你三人已是穷途末路，若肯下跪求饶，本王保证给你们一个痛快。" }] } },
    { id: "char_mei_xun", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 95, line_end: 97, text: "梅洵道：在下南海派梅洵，寇少帅这么有兴致，不如先跟在下玩一场如何？" }] } },
  ],
};

// ===== Segment 2: lines 102-197 =====
const seg2 = {
  segment: 2,
  line_start: 102,
  line_end: 197,
  dialogues: [
    { speaker: "char_kou_zhong", speaker_name: "寇仲", listener: null, text: "陵少！台面！晃老头！", tone: "焦急", chapter: 344, line_start: 103, line_end: 103 },
    { speaker: "char_li_yuan_ji", speaker_name: "李元吉", listener: "char_kou_zhong", text: "小子找死！", tone: "愤怒", chapter: 344, line_start: 123, line_end: 123 },
    { speaker: "char_kou_zhong", speaker_name: "寇仲", listener: null, text: "三角阵", tone: "豪迈", chapter: 344, line_start: 169, line_end: 169 },
    { speaker: null, speaker_name: null, listener: null, text: "失火啦！失火啦！", tone: "慌张", chapter: 344, line_start: 175, line_end: 175 },
    { speaker: "char_zhu_yu_yan", speaker_name: "祝玉妍", listener: "char_kou_zhong", text: "能逃到这里来，算你们本事，小仲不是要和齐王单打独斗吗？", tone: "调侃", chapter: 344, line_start: 191, line_end: 193 },
  ],
  new_entities: { characters: [], skills: [], techniques: [], factions: [], locations: [], items: [] },
  entity_updates: [
    { id: "char_zhu_yu_yan", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 191, line_end: 193, text: "祝玉妍娇笑道：能逃到这里来，算你们本事，小仲不是要和齐王单打独斗吗？" }] } },
    { id: "char_kang_qiao_li", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 109, line_end: 109, text: "寇仲拿出井中月，往正匆忙从椅子起立迎战的李元吉、梅洵和康鞘利三人杀去。" }] } },
    { id: "char_pi_shou_xuan", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 189, line_end: 189, text: "墙头现出三道人影，祝玉妍居中，辟守玄和边不负分傍左右。" }] } },
    { id: "char_bian_bu_fu", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 189, line_end: 189, text: "墙头现出三道人影，祝玉妍居中，辟守玄和边不负分傍左右。" }] } },
    { id: "char_fu_zhen", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 165, line_end: 165, text: "以'长白双凶'符真、符彦为首的二十多名李阀与突厥好手组成的联军" }] } },
    { id: "char_fu_yan", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 165, line_end: 165, text: "以'长白双凶'符真、符彦为首的二十多名李阀与突厥好手组成的联军" }] } },
    { id: "char_li_nan_tian", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 173, line_end: 173, text: "李南天和手下率先从屋顶跃下，狂追而来。" }] } },
    { id: "char_qiu_tian_jue", updates: { rag_refs: [344], source_refs: [{ chapter: 344, line_start: 147, line_end: 147, text: "寇仲井中月疾劈从破门攻进来的丘天觉" }] } },
  ],
};

// Write progress file
const lines = [JSON.stringify(seg1), JSON.stringify(seg2)];
fs.writeFileSync(progressFile, lines.join('\n') + '\n', 'utf8');
console.log('Written', progressFile, 'with', lines.length, 'segments');

// Write summary
const summary = '第344章 插翼难飞\n\n寇仲和突利在月兰舍被李元吉和康鞘利的人重重围困，云帅突然现身，道出祝玉妍借刀杀人之计。原来游秋雁通风报信是阴癸派的圈套，引诱三人自投罗网。寇仲冷静分析局势后向李元吉挑战，借机破门突围。徐子陵将云石桌面飞掷破墙，三人以三角阵冲杀，先后击退李元吉、梅洵、康鞘利、符真、符彦等高手。混战中有人放火制造混乱，三人破壁至西院墙欲逃，却被祝玉妍、辟守玄和边不负拦阻，陷入绝境。';
fs.writeFileSync(path.join(batchDir, 'ch_344_summary.txt'), summary, 'utf8');
console.log('Written summary');
