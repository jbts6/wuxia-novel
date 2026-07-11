const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'characters.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const biographies = {
  "char_yang_guo": "杨过是杨康之子，自幼父母双亡，被郭靖送到全真教学艺，受尽欺凌。后逃入古墓派，拜小龙女为师，与之相爱。他性格叛逆不羁，却重情重义。被郭芙斩断右臂后，得神雕相助习得玄铁剑法。十六年后与小龙女重逢，二人携手击退蒙古大军。他是金庸笔下最深情的大侠，一生只爱小龙女一人。",
  "char_xiao_long_nyu": "小龙女是古墓派传人，冷若冰霜，容貌绝美。她自幼在古墓中长大，不通世事。与杨过相爱后，历经磨难：被尹志平玷污、中毒无解、跳下绝情谷。十六年后在谷底与杨过重逢。她武功高强，精通玉女心经和素心剑法。最终与杨过携手隐居。",
  "char_guo_jing": "郭靖是侠之大者，为国为民。他镇守襄阳数十年，抵御蒙古入侵。性格憨厚正直，武功高强，精通降龙十八掌和九阴真经。他将杨过视如己出，却因杨康之死而对杨过心存芥蒂。最终襄阳城破，与黄蓉一同殉国。",
  "char_huang_rong": "黄蓉是黄药师之女，聪慧绝伦，丐帮帮主。她与郭靖相爱相守，为护女儿郭芙对杨过多有防备。她精通打狗棒法和桃花岛武功，是书中最聪明的女子。最终与郭靖一同殉国襄阳。",
  "char_guo_fu": "郭芙是郭靖黄蓉之女，骄纵任性，美貌却愚蠢。她一怒之下斩断杨过右臂，是书中最大的过错之一。后嫁给耶律齐，成为丐帮帮主夫人。",
  "char_guo_xiang": "郭襄是郭靖黄蓉之女，豪爽仗义，一生仰慕神雕大侠杨过。她在风陵渡口与杨过相识，从此念念不忘。杨过与小龙女重逢后，她心灰意冷，最终出家创立峨嵋派。",
  "char_li_mo_chou": "李莫愁是古墓派弟子，因情生恨，外号赤练仙子。她爱上陆展元却被抛弃，从此性情大变，杀人如麻。她暗恋杨过却不敢承认，最终在绝情谷中葬身火海，死前仍念着问世间情为何物。",
  "char_jin_lun_fa_wang": "金轮法王是蒙古第一高手，武功高强，精通龙象般若功。他与中原群侠多次交锋，是书中最大的反派。最终在襄阳城下被杨过以黯然销魂掌击败。",
  "char_zhou_bo_tong": "周伯通是全真教弟子，外号老顽童，天真烂漫，武功冠绝天下。他精通空明拳、双手互搏和九阴真经。与一灯大师、黄药师等人是旧交。性格童心未泯，是书中最可爱的老人家。",
  "char_yi_deng_da_shi": "一灯大师原是大理皇帝段智兴，出家为僧后法号一灯。他精通一阳指，武功高强。因当年不肯救瑛姑之子而心怀愧疚，最终与瑛姑、周伯通和解。",
  "char_huang_yao_shi": "黄药师是桃花岛主，外号东邪，琴棋书画医卜无所不通。他性格孤傲狂放，不拘礼法。他深爱妻子冯氏，妻子死后性情更加古怪。最终与女儿黄蓉和解。",
  "char_gong_sun_zhi": "公孙止是绝情谷主，阴险狡诈，贪慕小龙女美色。他妻子裘千尺被他推入山谷，他却装作无辜。最终被裘千尺复仇，夫妻同归于尽。",
  "char_gong_sun_lu_e": "公孙绿萼是公孙止之女，温柔善良。她爱上杨过，为救杨过甘愿牺牲性命。最终被父亲公孙止误杀，是书中最令人怜惜的女子之一。",
  "char_ye_lv_qi": "耶律齐是耶律楚材之子，稳重有才干，武功不弱。他娶郭芙为妻，后成为丐帮帮主。在襄阳保卫战中英勇作战。",
  "char_cheng_ying": "程英是黄药师弟子，温柔内敛，一生暗恋杨过却默默守候。她精通弹指神通和玉箫剑法，是书中最温柔的女子之一。",
  "char_lu_wu_shuang": "陆无双是李莫愁弟子，泼辣直爽，暗恋杨过一生。她性格倔强，武功不弱。最终与程英一起陪伴杨过。",
  "char_wu_san_tong": "武三通是一灯大师弟子，痴恋义女何沅君，疯疯癫癫。他性格古怪，武功不弱。最终与妻子和好。",
  "char_wu_dun_ru": "武敦儒是武三通之子，郭靖弟子，性格敦厚。他与弟弟武修文一起拜郭靖为师。",
  "char_wu_xiu_wen": "武修文是武三通之子，郭靖弟子，曾暗恋郭芙。他性格机灵，后娶完颜萍为妻。",
  "char_wan_yan_ping": "完颜萍是金国遗族女子，暗恋杨过后嫁给武修文。她性格温婉，武功不弱。",
  "char_ou_yang_feng": "欧阳锋是西毒，逆练九阴真经致疯癫。他认杨过为义父，对杨过有真感情。最终在华山之巅大笑而亡。",
  "char_ke_zhen_e": "柯镇恶是江南七怪之首，瞎眼却刚正不阿。他是郭靖的恩师，性格暴躁却重义轻生。",
  "char_qiu_qian_ren": "裘千仞原是铁掌帮主，后改邪归正出家为僧。他武功高强，最终被金轮法王击毙。",
  "char_huo_du": "霍都是蒙古王子，金轮法王弟子，阴险狡诈。他武功不弱，最终被杨过击败。",
  "char_da_er_ba": "达尔巴是金轮法王大弟子，憨厚忠诚的蒙古武士。他武功高强，性格忠厚。",
  "char_yin_ke_xi": "尹克西是波斯商人出身的蒙古高手，精于算计，武功不弱。",
  "char_xiao_xiang_zi": "潇湘子是湘西名宿，蒙古阵营高手，武功诡异。他性格阴险，最终被杨过击败。",
  "char_jue_yuan": "觉远是少林寺藏经阁僧人，内功深厚却不自知。他默诵九阳真经，最终圆寂前将九阳真经传给张君宝和郭襄。",
  "char_zhang_jun_bao": "张君宝是少林小僧，得杨过指点，后创立武当派，成为一代宗师张三丰。他天赋异禀，武功高强。",
  "char_hong_ling_bo": "洪凌波是李莫愁大弟子，性格温顺，命途多舛。她跟随李莫愁多年，最终被李莫愁误杀。",
  "char_lu_li_ding": "陆立鼎是陆展元之弟，因兄嫂恩怨被李莫愁杀害。他性格懦弱，武功平平。",
  "char_lu_er_niang": "陆二娘是陆立鼎之妻，随夫被李莫愁杀害。",
  "char_shi_shu_gang": "史叔刚是万兽山庄庄主，驯兽高手。他性格豪爽，武功不弱。",
  "char_shi_shao_je": "史少捷是万兽山庄少庄主，史叔刚之弟。",
  "char_da_tou_gui": "大头鬼是西山一窟鬼之一，头大身矮的怪人。他性格古怪，武功不弱。",
  "char_zhao_zhi_jing": "赵志敬是全真教道士，阴险狡诈。他虐待杨过，后叛教投蒙。最终被周伯通制服。",
  "char_zhen_zhi_bing": "甄志丙是全真教道士，暗恋小龙女。他为赎罪而死，是书中少有的正面全真教人物。",
  "char_tian_zhu_seng": "天竺僧是医术高明的天竺僧，一灯大师师弟。他精通医术，为杨过和小龙女治病。",
  "char_ci_en": "慈恩原是裘千仞，改邪归正出家为僧。他忏悔挣扎，最终在金轮法王手下解脱。"
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
console.log(`Updated ${data.length} characters in 神雕侠侣`);

// Verify
const verify = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const withBio = verify.filter(c => c.biography && c.biography.trim().length > 0).length;
const withoutBio = verify.filter(c => !c.biography || c.biography.trim().length === 0).length;
console.log(`With biography: ${withBio}, Without: ${withoutBio}`);
