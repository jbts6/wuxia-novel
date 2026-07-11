const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'characters.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const biographies = {
  "char_zhang_wu_ji": "张无忌是张翠山与殷素素之子，自幼父母双亡，在冰火岛长大。他身中玄冥神掌寒毒，后在昆仑山腹中习得九阳神功，化解寒毒。又习得乾坤大挪移、太极拳剑等绝学，武功天下第一。他性格优柔寡断，在赵敏、周芷若、小昭、殷离四女之间摇摆不定。最终成为明教教主，带领明教推翻元朝。后与赵敏退隐江湖。",
  "char_zhao_min": "赵敏是汝阳王之女，蒙古郡主，聪慧机敏，美貌绝伦。她初为朝廷效力，与张无忌为敌，后爱上张无忌，放弃郡主身份。她性格刚烈果断，为爱不顾一切。最终与张无忌退隐江湖。",
  "char_xie_xun": "谢逊是明教金毛狮王，武功高强。他被成昆灭其满门，从此疯狂复仇，滥杀无辜。他抢走屠龙刀，与张翠山夫妇流落冰火岛。后在少林寺归佛，放下执念。最终在少林寺中终老。",
  "char_zhang_cui_shan": "张翠山是武当七侠之五，张三丰的得意弟子，武功不弱，人称铁画银钩。他与殷素素相爱，在冰火岛生活十年。回到中原后，因义兄谢逊之事被各派逼迫，最终与殷素素一同自尽殉义。",
  "char_zhou_zhi_ruo": "周芷若原是温婉善良的少女，拜灭绝师太为师。她深爱张无忌，却因灭绝师太的遗命而被迫夺取倚天剑和屠龙刀。她从温婉少女变为心机深沉的掌门人，最终在少林寺英雄大会上被黄衫女子击败。",
  "char_yin_su_su": "殷素素是天鹰教教主之女，性格刚烈果断。她与张翠山相爱，在冰火岛生活十年。回到中原后，因谢逊之事被各派逼迫，最终与张翠山一同自尽殉义。",
  "char_yang_xiao": "杨逍是明教光明左使，文武双全，智谋过人。他与纪晓芙相爱，生下杨不悔。他性格高傲，不把天下英雄放在眼里。最终辅佐张无忌管理明教。",
  "char_zhang_san_feng": "张三丰是武当派创始人，武功深不可测，太极拳剑之祖。他少年时得觉远传授九阳真经，后创立武当派，成为一代宗师。他性格豁达，不拘小节，对弟子慈爱。活了一百多岁，是书中最德高望重的老人家。",
  "char_mie_jue_shi_tai": "灭绝师太是峨嵋派掌门，手持倚天剑，性格刚烈，痛恨明教。她逼迫周芷若夺取倚天剑和屠龙刀，最终在万安寺中自尽殉派。",
  "char_wei_yi_xiao": "韦一笑是明教青翼蝠王，轻功独步天下。他因修炼寒冰绵掌走火入魔，需要吸人血续命。性格古怪，却对明教忠心耿耿。",
  "char_yin_tian_zheng": "殷天正是天鹰教教主，白眉鹰王，武功高强。他性格刚烈，后率天鹰教归附明教。最终在少林寺英雄大会上力战而亡。",
  "char_fan_yao": "范遥是明教光明右使，为探查成昆下落自毁容貌潜伏元廷。他性格坚忍，对明教忠心耿耿。最终与张无忌等人一起推翻元朝。",
  "char_cheng_kun": "成昆是少林僧人圆真，实为幕后黑手。他害谢逊满门逼其发疯，暗中挑拨六大门派与明教的矛盾。他性格阴险毒辣，是书中最大的反派。最终被谢逊制服。",
  "char_xiao_zhao": "小昭是波斯明教圣女，黛绮丝之女。她为张无忌甘愿做侍女，性格温柔忠贞。最终为救张无忌而回归波斯，成为波斯明教教主。",
  "char_yin_li": "殷离是殷天正孙女，痴恋张无忌。她练千蛛万毒手毁容，性格倔强。最终与张无忌告别，独自离去。",
  "char_song_yuan_qiao": "宋远桥是武当七侠之首，张三丰大弟子，武功稳重扎实。他性格沉稳，是武当七侠中的领袖。",
  "char_huang_shan_nv_zi": "黄衫女子是杨过后人，武功高强。她在少林寺英雄大会上击败周芷若，揭穿周芷若的阴谋。她出场神秘，是书中的关键人物之一。",
  "char_dai_qi_si": "黛绮丝是明教紫衫龙王，金花婆婆，容貌绝美。她与谢逊有旧怨，后为保护女儿小昭而隐居。她性格高傲，武功不弱。",
  "char_yu_lian_zhou": "俞莲舟是武当七侠之二，武功在七侠中最强。他性格沉稳，不苟言笑，是张三丰最得意的弟子之一。",
  "char_yu_dai_yan": "俞岱岩是武当七侠之三，早年被殷素素误伤致残。他性格刚直，武功不弱。",
  "char_zhang_song_xi": "张松溪是武当七侠之四，足智多谋。他性格机灵，善于出谋划策。",
  "char_yin_li_ting": "殷梨亭是武当七侠之六，与纪晓芙有婚约。他性格温文尔雅，后娶杨不悔为妻。",
  "char_mo_sheng_gu": "莫声谷是武当七侠之七，性格刚烈。他武功不弱，最终被陈友谅暗杀。",
  "char_jue_yuan": "觉远是少林寺藏经阁僧人，默诵九阳真经，内功深厚却不自知。他圆寂前将九阳真经传给张君宝和郭襄，为武当派和峨嵋派的创立奠定基础。",
  "char_kong_wen": "空闻是少林寺方丈，主持少林寺英雄大会。他武功深厚，性格沉稳。",
  "char_kong_zhi": "空智是少林寺高僧，武功深厚。他性格刚直，在少林寺中颇有威望。",
  "char_kong_jian": "空见是少林四大神僧之首，武功最高。他被成昆利用，劝谢逊罢手，最终被谢逊以七伤拳击毙。",
  "char_kong_xing": "空性是少林高僧，以龙爪手闻名。他武功不弱，性格刚直。",
  "char_wu_se_chan_shi": "无色禅师是少林寺罗汉堂首座，武功不弱。他性格沉稳，在少林寺中颇有威望。",
  "char_he_tai_chong": "何太冲是昆仑派掌门，精通两仪剑法。他性格懦弱，被妻子班淑娴压制。",
  "char_ban_shu_xian": "班淑娴是昆仑派掌门夫人，精通两仪剑法。她性格强势，压制丈夫何太冲。",
  "char_yang_bu_hui": "杨不悔是杨逍与纪晓芙之女，性格倔强。她后嫁给殷梨亭，成为武当七侠之一的妻子。",
  "char_yin_ye_wang": "殷野王是殷天正之子，天鹰教少主。他武功不弱，性格高傲。",
  "char_ding_min_jun": "丁敏君是峨嵋派弟子，性格刻薄，嫉妒心强。她与周芷若争斗多年。",
  "char_ji_xiao_fu": "纪晓芙是峨嵋派弟子，与杨逍相爱。她被灭绝师太逼迫杀杨逍，却宁死不从，最终被灭绝师太处死。",
  "char_jing_xuan": "静玄是峨嵋派大弟子，武功不弱，性格沉稳。",
  "char_chen_you_liang": "陈友谅是丐帮弟子，野心勃勃。他暗杀莫声谷，后投靠元廷。最终被朱元璋处死。",
  "char_zhou_dian": "周颠是明教五散人之一，性格癫狂，说话疯疯癫癫。他武功不弱，对明教忠心耿耿。",
  "char_shuo_bu_de": "说不得是明教五散人之一，乾坤一气袋的主人。他性格古怪，说话拐弯抹角。",
  "char_peng_ying_yu": "彭莹玉是明教五散人之一，僧人打扮。他武功不弱，对明教忠心耿耿。",
  "char_leng_qian": "冷谦是明教五散人之一，沉默寡言。他武功不弱，性格沉稳。",
  "char_tie_guan_dao_ren": "铁冠道人是明教五散人之一，道士打扮。他武功不弱，性格古怪。",
  "char_ru_yang_wang": "汝阳王是元朝汝阳王，赵敏之父。他手握重兵，镇压明教起义。最终被朱元璋击败。",
  "char_lu_zhang_ke": "鹿杖客是玄冥二老之一，为汝阳王效力。他武功高强，性格阴险。",
  "char_he_bi_weng": "鹤笔翁是玄冥二老之一，为汝阳王效力。他武功高强，性格阴险。",
  "char_he_zu_dao": "何足道是昆仑三圣，挑战少林寺。他武功高强，性格孤傲。",
  "char_tian_ming": "天鸣禅师是少林寺方丈，被成昆毒死。他性格懦弱，武功平平。"
};

// Add biography field to each character
for (const char of data) {
  if (biographies.hasOwnProperty(char.id)) {
    char.biography = biographies[char.id];
  } else {
    char.biography = "";
  }
}

// Write back
fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Updated ${data.length} characters in 倚天屠龙记`);

// Verify
const verify = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const withBio = verify.filter(c => c.biography && c.biography.trim().length > 0).length;
const withoutBio = verify.filter(c => !c.biography || c.biography.trim().length === 0).length;
console.log(`With biography: ${withBio}, Without: ${withoutBio}`);
