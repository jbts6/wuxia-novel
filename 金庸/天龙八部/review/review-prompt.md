# Dialogues Review Prompt

## 角色

你是一位武侠小说设定库的**审阅专家**，目标是**挑刺**。你需要审阅本书的 dialogues.json，找出最可疑的条目。

## 输入

1. `dialogues.json`：对话数组，每条包含 speaker、listener、text、tone、chapter、line_start、line_end
2. `characters.json`：角色数组，用于验证 speaker/listener 是否存在
3. `manifest.json`：章节清单，用于了解本书的章节结构

## 审阅标准

对每条对话，检查以下问题：

### 1. 跨书混淆（最严重）
- 对话内容是否包含其他武侠作品的元素？
- 检查方法：查看对话中提到的人名、地名、武功、道具是否属于本书
- 常见问题：提到其他金庸/古龙/梁羽生/黄易作品的角色或元素

### 2. 说话风格不符
- 说话风格是否符合角色性格？
- 检查方法：参考 characters.json 中的 personality.traits 和 speech_style
- 常见问题：文绉绉的角色说出现代口语，或豪迈的角色说话过于文雅

### 3. 时代背景错误
- 对话是否符合本书的时代背景？
- 检查方法：参考 manifest.json 中的时代信息（如有）
- 常见问题：出现现代用语、不符合时代的表达

### 4. 措辞偏差（可能 LLM 凭记忆写而非原文）
- 对话是否像是 LLM 凭记忆写的，而非原文？
- 检查方法：对比已知的本书经典台词
- 常见问题：措辞过于现代或口语化，与原文风格不符

### 5. 情节逻辑错误
- 对话是否与上下文情节矛盾？
- 检查方法：参考 chapter_summaries.json（如有）
- 常见问题：角色在不可能的时间/地点说话，对话内容与已知情节冲突

## 输出格式

输出一个 JSON 数组，包含所有可疑条目（最多 50 条，按严重程度排序）：

```json
[
  {
    "index": 0,
    "speaker": "char_xxx",
    "text": "原始对话文本",
    "chapter": 1,
    "issue_type": "cross_book|style|era|wording|logic",
    "severity": "high|medium|low",
    "reason": "具体问题描述",
    "suggestion": "建议处理方式（删除/重读原文/人工复核）"
  }
]
```

## 工作流

1. 先通读 characters.json，建立角色性格基线
2. 逐条审阅 dialogues.json，按上述标准检查
3. 对可疑条目，记录问题类型和严重程度
4. 按严重程度排序输出（high → medium → low）

## 注意事项

- 不要过度挑刺：只标记真正有问题的条目，不要因为"措辞不够优美"就标记
- 优先标记跨书混淆和时代错误，这些是硬伤
- 对于"可能措辞偏差"，只标记非常明显的问题（如现代用语）
- 如果不确定，宁可不标记，避免假阳性

## 输出

直接输出 JSON 数组，不要额外解释。


## 数据

### characters.json (摘要)
[
  {
    "id": "char_duan_yu",
    "name": "段誉",
    "role": "核心",
    "personality": [
      "温文尔雅",
      "痴情专一",
      "不喜武功"
    ],
    "one_line": "大理段氏世子，痴情书生，因缘际会习得六脉神剑与北冥神功"
  },
  {
    "id": "char_xiao_feng",
    "name": "萧峰",
    "role": "核心",
    "personality": [
      "豪迈大方",
      "重情重义",
      "武艺高强"
    ],
    "one_line": "丐帮前帮主，契丹人，身世坎坷的悲剧英雄，ch21前名为乔峰"
  },
  {
    "id": "char_xu_zhu",
    "name": "虚竹",
    "role": "核心",
    "personality": [
      "憨厚老实",
      "心地善良",
      "重情重义"
    ],
    "one_line": "少林小和尚，因缘际会成为逍遥派掌门，与梦姑（西夏公主）相爱"
  },
  {
    "id": "char_wang_yu_yan",
    "name": "王语嫣",
    "role": "重要",
    "personality": [
      "博学多才",
      "温婉可人",
      "痴情专一"
    ],
    "one_line": "慕容复表妹，熟读天下武学，后与段誉结为夫妻"
  },
  {
    "id": "char_mu_rong_fu",
    "name": "慕容复",
    "role": "重要",
    "personality": [
      "野心勃勃",
      "心狠手辣",
      "武艺高强"
    ],
    "one_line": "姑苏慕容氏传人，一心复兴大燕，后疯癫"
  },
  {
    "id": "char_a_zhu",
    "name": "阿朱",
    "role": "重要",
    "personality": [
      "温柔善良",
      "聪慧机敏",
      "易容术高超"
    ],
    "one_line": "慕容复婢女，与萧峰相爱，为救萧峰而死"
  },
  {
    "id": "char_a_zi",
    "name": "阿紫",
    "role": "重要",
    "personality": [
      "刁蛮任性",
      "心狠手辣",
      "痴情专一"
    ],
    "one_line": "星宿派弟子，阿朱妹妹，对萧峰痴情"
  },
  {
    "id": "char_you_tan_zhi",
    "name": "游坦之",
    "role": "重要",
    "personality": [
      "痴情懦弱",
      "命运多舛",
      "心地善良"
    ],
    "one_line": "聚贤庄少庄主，对阿紫痴情，误练易筋经后武功大进"
  },
  {
    "id": "char_duan_zheng_chun",
    "name": "段正淳",
    "role": "重要",
    "personality": [
      "风流倜傥",
      "重情重义",
      "武艺高强"
    ],
    "one_line": "大理镇南王，风流倜傥，与多位女子有情"
  },
  {
    "id": "char_mu_wan_qing",
    "name": "木婉清",
    "role": "重要",
    "personality": [
      "外刚内柔",
      "敢爱敢恨",
      "武艺不俗"
    ],
    "one_line": "段正淳与秦红棉之女，对段誉痴情"
  },
  {
    "id": "char_zhong_ling",
    "name": "钟灵",
    "role": "重要",
    "personality": [
      "天真烂漫",
      "活泼可爱",
      "心地善良"
    ],
    "one_line": "钟万仇与甘宝宝之女，天真烂漫"
  },
  {
    "id": "char_jiu_mo_zhi",
    "name": "鸠摩智",
    "role": "重要",
    "personality": [
      "武功高强",
      "贪恋武学",
      "诡计多端"
    ],
    "one_line": "吐蕃护国法王，武功高强，痴迷少林绝技"
  },
  {
    "id": "char_ding_chun_qiu",
    "name": "丁春秋",
    "role": "重要",
    "personality": [
      "心狠手辣",
      "诡计多端",
      "武功高强"
    ],
    "one_line": "星宿派掌门，逍遥派叛徒，善用毒功"
  },
  {
    "id": "char_xuan_ci",
    "name": "玄慈",
    "role": "重要",
    "personality": [
      "慈悲为怀",
      "佛法高深",
      "重情重义"
    ],
    "one_line": "少林寺方丈，虚竹师父，身怀秘密"
  },
  {
    "id": "char_xiao_yuan_shan",
    "name": "萧远山",
    "role": "重要",
    "personality": [
      "隐忍深沉",
      "武功高强",
      "心怀仇恨"
    ],
    "one_line": "萧峰之父，雁门关血案幸存者，隐居少林三十年复仇"
  },
  {
    "id": "char_tian_shan_tong_lao",
    "name": "天山童姥",
    "role": "重要",
    "personality": [
      "武功高强",
      "心狠手辣",
      "外刚内柔"
    ],
    "one_line": "逍遥派大师姐，天山童姥，武功高强，身形如孩童"
  },
  {
    "id": "char_li_qiu_shui",
    "name": "李秋水",
    "role": "重要",
    "personality": [
      "武功高强",
      "心机深沉",
      "外柔内刚"
    ],
    "one_line": "逍遥派二师姐，西夏皇太妃，与天山童姥争斗一生"
  },
  {
    "id": "char_wu_ya_zi",
    "name": "无崖子",
    "role": "重要",
    "personality": [
      "武功高强",
      "才华横溢",
      "重情重义"
    ],
    "one_line": "逍遥派掌门，武功高强，被丁春秋暗算后隐居"
  },
  {
    "id": "char_ye_lv_hong_ji",
    "name": "耶律洪基",
    "role": "重要",
    "personality": [
      "雄才大略",
      "重情重义",
      "野心勃勃"
    ],
    "one_line": "辽国皇帝，与萧峰结义，后逼萧峰攻宋"
  },
  {
    "id": "char_mu_rong_bo",
    "name": "慕容博",
    "role": "重要",
    "personality": [
      "心机深沉",
      "武功高强",
      "野心勃勃"
    ],
    "one_line": "慕容复之父，雁门关血案幕后推手"
  },
  {
    "id": "char_qin_hong_mian",
    "name": "秦红棉",
    "role": "次要",
    "personality": [
      "外刚内柔",
      "敢爱敢恨",
      "重情重义"
    ],
    "one_line": "段正淳情妇，木婉清之母，外号修罗刀"
  },
  {
    "id": "char_ruan_xing_zhu",
    "name": "阮星竹",
    "role": "次要",
    "personality": [
      "温柔善良",
      "重情重义",
      "外柔内刚"
    ],
    "one_line": "段正淳情妇，阿朱阿紫之母"
  },
  {
    "id": "char_dao_bai_feng",
    "name": "刀白凤",
    "role": "次要",
    "personality": [
      "外刚内柔",
      "重情重义",
      "刚烈不屈"
    ],
    "one_line": "段正淳正妻，段誉之母，出家为道"
  },
  {
    "id": "char_gan_bao_bao",
    "name": "甘宝宝",
    "role": "次要",
    "personality": [
      "温柔善良",
      "重情重义",
      "外柔内刚"
    ],
    "one_line": "钟万仇之妻，钟灵之母，曾是段正淳情妇"
  },
  {
    "id": "char_zhong_wan_chou",
    "name": "钟万仇",
    "role": "次要",
    "personality": [
      "心狠手辣",
      "嫉妒心强",
      "重情重义"
    ],
    "one_line": "钟灵之父，甘宝宝之夫，外号见人就杀"
  },
  {
    "id": "char_xi_xia_gong_zhu",
    "name": "西夏公主",
    "role": "重要",
    "personality": [
      "温婉可人",
      "痴情专一",
      "心地善良"
    ],
    "one_line": "西夏公主，与虚竹在冰窖中相爱"
  }
]

### dialogues.json (前 50 条)
[
  {
    "index": 0,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": null,
    "text": "在下单名一誉字，从来没学过什么武艺。我看到别人摔交，不论他真摔还是假摔，忍不住总是要笑的。",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 30,
    "line_end": 30
  },
  {
    "index": 1,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": "char_gong_guang_jie",
    "text": "你师父是你的师父，你师父可不是我的师父。你师父差得动你，你师父可差不动我。你师父叫你跟人家比剑，你已经跟人家比过了。你师父叫我跟你比剑，我一来不会，二来怕输，三来怕痛，四来怕死，因此是不比的。我说不比，就是不比。",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 38,
    "line_end": 38
  },
  {
    "index": 2,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": null,
    "text": "你这位大爷，怎地如此狠霸霸的？我平生最不爱瞧人打架。贵派叫做无量剑，住在无量山中。佛经有云：'无量有四：一慈、二悲、三喜、四舍。'",
    "tone": "调侃",
    "chapter": 1,
    "line_start": 44,
    "line_end": 44
  },
  {
    "index": 3,
    "speaker": "char_zhong_ling",
    "speaker_name": "钟灵",
    "listener": "char_duan_yu",
    "text": "喂，段誉，我的名字，不用钟灵这小鬼跟你说，我自己说好了，我叫木婉清。",
    "tone": "陈述",
    "chapter": 3,
    "line_start": 40,
    "line_end": 40
  },
  {
    "index": 4,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": "char_mu_wan_qing",
    "text": "啊，水木清华，婉兮清扬。姓得好，名字也好。",
    "tone": "欣喜",
    "chapter": 3,
    "line_start": 41,
    "line_end": 41
  },
  {
    "index": 5,
    "speaker": null,
    "speaker_name": "保定帝",
    "listener": "char_duan_yu",
    "text": "誉儿，你遇过星宿海的丁春秋吗？",
    "tone": "疑问",
    "chapter": 10,
    "line_start": 62,
    "line_end": 62
  },
  {
    "index": 6,
    "speaker": null,
    "speaker_name": "保定帝",
    "listener": null,
    "text": "这人有一身邪门功夫，善消别人内力，叫作'化功大法'，能令人毕生武学修为废于一旦，天下武林之士，无不深恶痛绝。",
    "tone": "陈述",
    "chapter": 10,
    "line_start": 66,
    "line_end": 66
  },
  {
    "index": 7,
    "speaker": "char_xiao_feng",
    "speaker_name": "乔峰",
    "listener": "char_duan_yu",
    "text": "好兄弟，来来来，咱哥儿俩上岸去斗酒，喝他二十大碗。",
    "tone": "欣喜",
    "chapter": 14,
    "line_start": 2,
    "line_end": 5
  },
  {
    "index": 8,
    "speaker": "char_a_zhu",
    "speaker_name": "阿朱",
    "listener": "char_xiao_feng",
    "text": "你身材魁梧，一站出去就引得人人注目，最好改装成一个形貌寻常、身上没丝毫特异之处的江湖豪士。这种人在道上一天能撞见几百个，那就谁也不会来向你多瞧一眼。",
    "tone": "陈述",
    "chapter": 21,
    "line_start": 14,
    "line_end": 14
  },
  {
    "index": 9,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_a_zhu",
    "text": "我若死在段正淳手下，谁陪你在雁门关外牧牛放羊呢？",
    "tone": "调侃",
    "chapter": 22,
    "line_start": 50,
    "line_end": 50
  },
  {
    "index": 10,
    "speaker": "char_a_zhu",
    "speaker_name": "阿朱",
    "listener": "char_xiao_feng",
    "text": "唉，不知怎样，我总觉得这件事情之中有什么不对。那个马夫人，那……马夫人，这般冰清玉洁的模样，我见了她，却不自禁的觉得可怕厌憎。",
    "tone": "陈述",
    "chapter": 22,
    "line_start": 52,
    "line_end": 52
  },
  {
    "index": 11,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_a_zhu",
    "text": "错了，你大哥第一爱阿朱，第二才爱喝酒，第三爱打架！",
    "tone": "欣喜",
    "chapter": 22,
    "line_start": 120,
    "line_end": 120
  },
  {
    "index": 12,
    "speaker": "char_a_zhu",
    "speaker_name": "阿朱",
    "listener": "char_xiao_feng",
    "text": "大哥，报仇大事，不争一朝一夕。咱们谋定而后动，就算敌众我寡，不能力胜，难道不能智取么？",
    "tone": "恳求",
    "chapter": 22,
    "line_start": 130,
    "line_end": 130
  },
  {
    "index": 13,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": null,
    "text": "父母之仇，不共戴天。报此大仇，已不用管江湖上的什么规矩道义，多恶毒的手段也使得上。",
    "tone": "愤怒",
    "chapter": 22,
    "line_start": 132,
    "line_end": 132
  },
  {
    "index": 14,
    "speaker": null,
    "speaker_name": "向望海",
    "listener": "char_bao_qian_ling",
    "text": "'阎王敌'薛神医突然大撒英雄帖，遍邀江湖同道，势头又这般紧迫，说什么'英豪见帖，便请驾临'。鲍大哥，你可知为了何事？",
    "tone": "疑问",
    "chapter": 19,
    "line_start": 2,
    "line_end": 4
  },
  {
    "index": 15,
    "speaker": null,
    "speaker_name": "鲍千灵",
    "listener": "char_xiang_wang_hai",
    "text": "唉，这几天心境挺坏，提不起做买卖兴致，今天听到他杀父、杀母、杀师的恶行，更加气愤！",
    "tone": "愤怒",
    "chapter": 19,
    "line_start": 6,
    "line_end": 6
  },
  {
    "index": 16,
    "speaker": null,
    "speaker_name": "徐长老",
    "listener": null,
    "text": "此人丧心病狂，行止乖张。本来嘛，他曾为敝帮立过不少大功，便在最近，咱们误中奸人暗算，也是他出手相救的。可是大丈夫立身处世，总当以大节为重，一些小恩小惠，也只好置之脑后了。",
    "tone": "陈述",
    "chapter": 19,
    "line_start": 100,
    "line_end": 104
  },
  {
    "index": 17,
    "speaker": null,
    "speaker_name": "鲍千灵",
    "listener": "char_xiao_feng",
    "text": "鲍千灵的项上人头，乔兄何时要取，随时来拿便是。鲍某专做没本钱生意，全副家当蚀在乔兄手上，也没什么。阁下连父亲、母亲、师父都杀，对鲍某这般泛泛之交，下手何必容情？",
    "tone": "愤怒",
    "chapter": 19,
    "line_start": 80,
    "line_end": 80
  },
  {
    "index": 18,
    "speaker": "char_xiao_feng",
    "speaker_name": "乔峰",
    "listener": "char_bao_qian_ling",
    "text": "听说'阎王敌'薛神医大撒英雄帖，在下颇想前去见识见识，便与三位一同前往如何？",
    "tone": "陈述",
    "chapter": 19,
    "line_start": 86,
    "line_end": 86
  },
  {
    "index": 19,
    "speaker": "char_xiao_feng",
    "speaker_name": "乔峰",
    "listener": "char_a_zhu",
    "text": "阿朱，明日我去给你找一个天下最好的大夫治伤，你放心安睡罢！",
    "tone": "欣喜",
    "chapter": 19,
    "line_start": 90,
    "line_end": 90
  },
  {
    "index": 20,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": null,
    "text": "我便是乔峰，你们倘若不说，后患无穷！",
    "tone": "愤怒",
    "chapter": 21,
    "line_start": 200,
    "line_end": 200
  },
  {
    "index": 21,
    "speaker": null,
    "speaker_name": "谭婆",
    "listener": "char_xiao_feng",
    "text": "乔帮主，今日之事，行善在你，行恶也在你。我师兄妹俩问心无愧，天日可表。你想要知道的事，恕我不能奉告。真正对不住！",
    "tone": "冷酷",
    "chapter": 21,
    "line_start": 210,
    "line_end": 210
  },
  {
    "index": 22,
    "speaker": null,
    "speaker_name": "赵钱孙",
    "listener": "char_tan_po",
    "text": "小娟，说不得，千万说不得。",
    "tone": "焦急",
    "chapter": 21,
    "line_start": 195,
    "line_end": 195
  },
  {
    "index": 23,
    "speaker": null,
    "speaker_name": "赵钱孙",
    "listener": "char_tan_po",
    "text": "小娟，我这一生从来没求过你什么，这是我唯一向你恳求的事，你说什么也得答允。",
    "tone": "恳求",
    "chapter": 21,
    "line_start": 205,
    "line_end": 205
  },
  {
    "index": 24,
    "speaker": null,
    "speaker_name": "吴长老",
    "listener": "char_xiao_feng",
    "text": "吴长风受众兄弟之托，将本帮打狗棒归还帮主。我们实在胡涂该死，猪油蒙了心，冤枉好人，累得帮主受了无穷困苦。大伙儿猪狗不如，只盼帮主大人不记小人过，念着我们是一群没爹没娘的孤儿，重来做本帮之主。",
    "tone": "恳求",
    "chapter": 50,
    "line_start": 100,
    "line_end": 104
  },
  {
    "index": 25,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_wu_zhang_lao",
    "text": "吴长老，在下确是契丹人。多承各位重义，在下感激不尽，帮主之位，却万万不能当。",
    "tone": "陈述",
    "chapter": 50,
    "line_start": 106,
    "line_end": 106
  },
  {
    "index": 26,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": "char_xiao_feng",
    "text": "大理乃僻处南疆的一个小国，这'皇帝'二字，更是僭号。小弟胡里胡涂，望之不似人君，怎有半点皇帝的味道？咱俩情逾骨肉，岂有大哥遭厄，小弟不来与大哥有难同当之理？",
    "tone": "欣喜",
    "chapter": 50,
    "line_start": 110,
    "line_end": 114
  },
  {
    "index": 27,
    "speaker": null,
    "speaker_name": "慧轮",
    "listener": "char_xu_zhu",
    "text": "该死，该死！你……喝了酒么？",
    "tone": "愤怒",
    "chapter": 39,
    "line_start": 200,
    "line_end": 200
  },
  {
    "index": 28,
    "speaker": "char_xu_zhu",
    "speaker_name": "虚竹",
    "listener": "char_hui_lun",
    "text": "师父，弟子……弟子真是该死，下山之后，把持不定，将师父……师父平素的教诲，都……都不遵守了。",
    "tone": "悲伤",
    "chapter": 39,
    "line_start": 198,
    "line_end": 198
  },
  {
    "index": 29,
    "speaker": "char_xu_zhu",
    "speaker_name": "虚竹",
    "listener": null,
    "text": "弟子不但喝酒，还喝得烂醉如泥。",
    "tone": "陈述",
    "chapter": 39,
    "line_start": 202,
    "line_end": 202
  },
  {
    "index": 30,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_duan_yu",
    "text": "三弟，你这六脉神剑尚未纯熟，六门剑法齐使，转换之时中间留有空隙，对方便能乘机趋避。你不妨只使一门剑法试试。",
    "tone": "陈述",
    "chapter": 42,
    "line_start": 50,
    "line_end": 50
  },
  {
    "index": 31,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_mu_rong_fu",
    "text": "丐帮向以仁侠为先，你身为一帮之主，岂可和星宿派的妖人同流合污？没的辱没了丐帮数百年来的侠义美名！",
    "tone": "愤怒",
    "chapter": 42,
    "line_start": 60,
    "line_end": 60
  },
  {
    "index": 32,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_mu_rong_fu",
    "text": "人家饶你性命，你反下毒手，算什么英雄好汉？",
    "tone": "愤怒",
    "chapter": 42,
    "line_start": 70,
    "line_end": 70
  },
  {
    "index": 33,
    "speaker": "char_xiao_feng",
    "speaker_name": "萧峰",
    "listener": "char_mu_rong_fu",
    "text": "萧某大好男儿，竟和你这种人齐名！",
    "tone": "愤怒",
    "chapter": 42,
    "line_start": 74,
    "line_end": 74
  },
  {
    "index": 34,
    "speaker": null,
    "speaker_name": "灰衣僧",
    "listener": "char_mu_rong_fu",
    "text": "你有儿子没有？",
    "tone": "疑问",
    "chapter": 42,
    "line_start": 80,
    "line_end": 80
  },
  {
    "index": 35,
    "speaker": "char_mu_rong_fu",
    "speaker_name": "慕容复",
    "listener": "char_hui_yi_seng",
    "text": "我尚未婚配，何来子息？",
    "tone": "陈述",
    "chapter": 42,
    "line_start": 82,
    "line_end": 82
  },
  {
    "index": 36,
    "speaker": null,
    "speaker_name": "灰衣僧",
    "listener": "char_mu_rong_fu",
    "text": "你高祖有儿子，你曾祖、祖父、父亲都有儿子，便是你没有儿子！嘿嘿，大燕国当年慕容皝、慕容恪、慕容垂、慕容德、慕容龙城何等英雄，却不料都变成了断种绝代的无后之人！",
    "tone": "嘲讽",
    "chapter": 42,
    "line_start": 86,
    "line_end": 86
  },
  {
    "index": 37,
    "speaker": null,
    "speaker_name": "灰衣僧",
    "listener": "char_mu_rong_fu",
    "text": "古来成大功业者，那一个不历尽千辛万苦？汉高祖有白登之困，汉光武有冀北之厄，倘若都似你这么引剑一割，只不过是个心窄气狭的自了汉而已，还说得上什么中兴开国？你连勾践、韩信也不如，当真无知无识！",
    "tone": "愤怒",
    "chapter": 42,
    "line_start": 90,
    "line_end": 90
  },
  {
    "index": 38,
    "speaker": null,
    "speaker_name": "灰衣僧",
    "listener": "char_xiao_feng",
    "text": "乔大侠武功卓绝，果然名不虚传，老衲想领教几招！",
    "tone": "陈述",
    "chapter": 42,
    "line_start": 100,
    "line_end": 100
  },
  {
    "index": 39,
    "speaker": "char_xu_zhu",
    "speaker_name": "虚竹",
    "listener": "char_yu_po_po",
    "text": "少林派是我师门，你言语不得无礼，快向少林寺方丈谢罪。",
    "tone": "愤怒",
    "chapter": 42,
    "line_start": 110,
    "line_end": 110
  },
  {
    "index": 40,
    "speaker": "char_mu_rong_fu",
    "speaker_name": "慕容复",
    "listener": "char_hui_yi_seng",
    "text": "慕容复知错了！",
    "tone": "悲伤",
    "chapter": 42,
    "line_start": 92,
    "line_end": 92
  },
  {
    "index": 41,
    "speaker": null,
    "speaker_name": "灰衣僧",
    "listener": "char_mu_rong_fu",
    "text": "这便是你慕容家的'参合指'！当年老衲从你先人处学来，也不过学到一些皮毛而已，慕容氏此外的神妙武功不知还有多少。嘿嘿，难道凭你少年人这一点儿微末道行，便创得下姑苏慕容氏'以彼之道，还施彼身'的大名么？",
    "tone": "嘲讽",
    "chapter": 42,
    "line_start": 94,
    "line_end": 94
  },
  {
    "index": 42,
    "speaker": null,
    "speaker_name": "南海鳄神",
    "listener": "char_duan_yu",
    "text": "小和尚，我早知你是个好和尚。你是我二姊的儿子，是我岳老二的侄儿。既是岳老二的侄儿，本领自然不会太差。",
    "tone": "欣喜",
    "chapter": 45,
    "line_start": 50,
    "line_end": 50
  },
  {
    "index": 43,
    "speaker": "char_wang_yu_yan",
    "speaker_name": "王语嫣",
    "listener": null,
    "text": "这是在黄泉地府么？我……我已经死了么？",
    "tone": "恐惧",
    "chapter": 45,
    "line_start": 60,
    "line_end": 60
  },
  {
    "index": 44,
    "speaker": null,
    "speaker_name": "云中鹤",
    "listener": null,
    "text": "姓云的最喜欢美貌姑娘，见到这王姑娘跳崖寻死，我自然舍不得，我是要抓她回去，做几天老婆。",
    "tone": "嘲讽",
    "chapter": 45,
    "line_start": 55,
    "line_end": 55
  },
  {
    "index": 45,
    "speaker": "char_a_zi",
    "speaker_name": "阿紫",
    "listener": "char_ye_lv_hong_ji",
    "text": "皇上的话，永不会错，你只须遵照皇上的话做，定有你好处。",
    "tone": "陈述",
    "chapter": 50,
    "line_start": 10,
    "line_end": 10
  },
  {
    "index": 46,
    "speaker": "char_a_zi",
    "speaker_name": "阿紫",
    "listener": "char_xiao_feng",
    "text": "姊夫，你居然还惦记着我。",
    "tone": "欣喜",
    "chapter": 50,
    "line_start": 20,
    "line_end": 20
  },
  {
    "index": 47,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": "char_xiao_feng",
    "text": "大哥，不好了！",
    "tone": "焦急",
    "chapter": 42,
    "line_start": 55,
    "line_end": 55
  },
  {
    "index": 48,
    "speaker": "char_wang_yu_yan",
    "speaker_name": "王语嫣",
    "listener": "char_duan_yu",
    "text": "段公子，手下留情！",
    "tone": "恳求",
    "chapter": 42,
    "line_start": 65,
    "line_end": 65
  },
  {
    "index": 49,
    "speaker": "char_duan_yu",
    "speaker_name": "段誉",
    "listener": "char_mu_rong_fu",
    "text": "咱们又没仇怨，何必再斗？不打了，不打了！",
    "tone": "焦急",
    "chapter": 42,
    "line_start": 72,
    "line_end": 72
  }
]

---

请审阅上述 dialogues，输出 JSON 数组（最多 50 条可疑条目）。
