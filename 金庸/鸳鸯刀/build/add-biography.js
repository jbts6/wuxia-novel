const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'characters.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const biographies = {
  "char_xiao_ban_he": "萧半和原名萧义，年轻时为报父仇自宫入宫为太监，在宫中潜伏多年。后从天牢救出袁、杨两位夫人，隐姓埋名为晋阳大侠，与两位夫人假扮夫妻十六年，暗中抚养袁冠南与萧中慧长大。他武功高强，精通混元气功，与大内高手卓天雄功力悉敌。五十寿辰时设计夺取鸳鸯刀，最终身份揭露，与卓天雄决战将其擒获。",
  "char_yuan_guan_nan": "袁冠南是袁夫人之子，三岁时母亲被萧半和从天牢救出，母子失散。他自幼游学在外，以书生身份行走江湖，以毛笔墨盒为武器，武功出自夫妻刀法一路。性格倜傥自喜、文采风流，与萧中慧相遇后互生情愫，一度误认为二人是亲兄妹而痛苦万分。最终真相大白，二人并非血亲，袁冠南与萧中慧结为夫妻，母子亦得以团聚。",
  "char_xiao_zhong_hui": "萧中慧是三湘大侠杨伯冲之女，幼年丧父后被萧半和收为养女，由杨夫人亲生、袁夫人共同抚养长大。她使双刀，侠义心肠，性格活泼倔强。在护送鸳鸯刀途中与袁冠南相遇，二人互生情愫，却因误以为是亲兄妹而痛苦。她武功虽不算顶尖，但临敌果断，敢爱敢恨。最终身世揭开，与袁冠南终成眷属。",
  "char_zhou_wei_xin": "周威信是威信镖局总镖头，绰号铁鞭镇八方，实则胆小谨慎、好面子。他受川陕总督刘于义之命，暗中护送鸳鸯刀进京。一路上提心吊胆，满口江湖谚语自我安慰。途中遭遇太岳四侠劫道、卓天雄追踪等波折，最终鸳鸯刀被夺走。他是书中典型的江湖小人物，贪生怕死却又不得不硬着头皮行事。",
  "char_zhuo_tian_xiong": "卓天雄是清廷大内七大高手之首，老奸巨猾，假扮瞎子暗中追踪鸳鸯刀下落。他武功深不可测，精通震天三十六掌和虎眼十八鞭，与萧半和功力悉敌。一路上以老瞎子身份混迹江湖，骗取众人信任。最终在萧半和寿辰上身份暴露，被萧半和与袁冠南联手制服。",
  "char_lin_yu_long": "林玉龙是任飞燕的丈夫，脾气暴躁，使单刀。他与妻子性格不合，见面就吵，动辄大打出手，实则深爱对方。二人习得夫妻刀法，却因配合不默契而威力大减。在太岳四侠劫道事件中与妻子大闹一场，后来在萧半和指点下领悟夫妻刀法真谛，与妻子和好如初。",
  "char_ren_fei_yan": "任飞燕是林玉龙的妻子，泼辣能干，弹弓百发百中。她与丈夫争吵不断，口齿伶俐，不肯吃亏，实则深爱丈夫。二人习得夫妻刀法却因脾气不合难以配合。在太岳四侠劫道事件中大展弹弓功夫，后来在萧半和指点下与丈夫领悟刀法真谛，夫妻和好。",
  "char_xiao_yao_zi": "逍遥子是太岳四侠之首，绰号烟霞神龙，自命不凡。他带领三位结义兄弟行侠仗义，实则武功平平，靠吹牛和义气撑场面。在劫道事件中被威信镖局镖师所伤，但仍不失老大哥风范。太岳四侠虽本事不济，却义气深重，是书中喜剧担当。",
  "char_chang_chang_feng": "常长风是太岳四侠之二，绰号双掌开碑，力大无穷，以墓碑为兵器。他性格卤莽冲动，好面子，经常在打斗中受伤，尤其是脚趾屡次被自己的墓碑砸中。他与三位结义兄弟一起闯荡江湖，虽武功不济但义气深重。",
  "char_hua_jian_ying": "花剑影是太岳四侠之三，绰号流星赶月，使流星锤。他性格尖酸刻薄，胆小怕事，爱惜门牙。与三位结义兄弟一起行走江湖，是四人中较为精明的一个，但武功同样平平。",
  "char_gai_yi_ming": "盖一鸣是太岳四侠之四，外号极长：八步赶蟾、赛专诸、踏雪无痕、独脚水上飞、双刺盖七省，使峨嵋刺。他口若悬河，好吹牛，是四人中最能说会道的。虽外号唬人，实则武功最差，但义气深重，与三位结义兄弟不离不弃。",
  "char_yuan_fu_ren": "袁夫人是袁冠南的亲生母亲，萧半和的大夫人。十六年前丈夫被害后被关入天牢，幸得萧半和相救。她与萧半和假扮夫妻掩护身份，对萧中慧视如己出，慈祥中自有一股威严。最终与失散十六年的儿子袁冠南重逢。",
  "char_yang_fu_ren": "杨夫人是萧中慧的亲生母亲，三湘大侠杨伯冲之妻，萧半和的二夫人。杨伯冲被害后，她带着幼女投奔萧半和，与袁夫人一起假扮夫妻掩护身份。她性格慈祥和蔼，深明大义，与袁夫人共同抚养萧中慧长大。",
  "char_liu_yu_yi": "",
  "char_wang_de_rong": "",
  "char_zhang_biao_shi": ""
};

// Add biography field to each character
for (const char of data) {
  if (biographies.hasOwnProperty(char.id)) {
    char.biography = biographies[char.id];
  } else {
    // Default to empty for any character not in our list
    char.biography = "";
  }
}

// Write back
fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Updated ${data.length} characters in 鸳鸯刀`);

// Verify
const verify = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const withBio = verify.filter(c => c.biography && c.biography.trim().length > 0).length;
const withoutBio = verify.filter(c => !c.biography || c.biography.trim().length === 0).length;
console.log(`With biography: ${withBio}, Without: ${withoutBio}`);
