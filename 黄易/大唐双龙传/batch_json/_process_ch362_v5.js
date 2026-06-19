const fs = require("fs");

const chapterFile = "/Users/admin/Site/wuxia-novel/黄易/大唐双龙传/ch_formatted/ch_362.md";
const progressFile = "/Users/admin/Site/wuxia-novel/黄易/大唐双龙传/batch_json/ch_362_progress.jsonl";
const summaryFile = "/Users/admin/Site/wuxia-novel/黄易/大唐双龙传/batch_json/ch_362_summary.txt";
const outputFile = "/Users/admin/Site/wuxia-novel/黄易/大唐双龙传/batch_json/ch_362.json";

const lines = fs.readFileSync(chapterFile, "utf8").split("\n");

const nameMap = [
  ["李秀宁", "char_li_xiu_ning"],
  ["秦叔宝", "char_qin_shu_bao"],
  ["徐子陵", "char_xu_zi_ling"],
  ["晃公错", "char_huang_gong_cuo"],
  ["杨虚彦", "char_yang_xu_yan"],
  ["杨文干", "char_yang_wen_gan"],
  ["李建成", "char_li_jian_cheng"],
  ["李元吉", "char_li_yuan_ji"],
  ["李世民", "char_li_shi_min"],
  ["寇仲", "char_kou_zhong"],
  ["岳山", "char_yue_shan"],
  ["祝玉妍", "char_zhu_yu_yan"],
  ["石之轩", "char_shi_zhi_xuan"],
  ["宋金刚", "char_song_jin_gang"],
  ["李靖", "char_li_jing"],
  ["王世充", "char_wang_shi_chong"]
];

const contextSpeakers = {
  "屋脊处有人": "晃公错",
  "那大汉见他": "杨文干",
  "那大汉": "杨文干"
};

function isActualDialogue(line, prevLine, nextLine) {
  // Filter out lines where quotes are used for narration, book titles, or descriptions
  // NOT actual character speech
  if (/心中不由浮起/.test(line)) return false;  // L127 - narration
  if (/车不容方轨/.test(line)) return false;  // L137 - quote in narration about 潼关
  if (/两掌一击/.test(line)) return false;  // L159 - narration
  if (/探手往怀内去/.test(line)) return false;  // L205 - narration
  if (/影子剌客/.test(line)) return false;  // L209 - narration
  if (/南海仙翁.*晃公错/.test(line)) return false;  // L215, L259 - narration
  if (/暴喝声中/.test(line)) return false;  // L259
  if (/连他自己也不明白/.test(line)) return false;  // L11 - narration
  if (/七杀拳/.test(line) && /自创/.test(line)) return false;  // L227 - narration
  if (/七杀拳/.test(line) && /是岳山/.test(line)) return false;  // L265 - narration
  if (/岳山.*躲到桌底/.test(line)) return false;  // L291 - narration with quotes around 岳山
  return true;
}

function findSpeaker(line, allLineArr, lineIdx) {
  // Special cases where name proximity is misleading
  // "这大唐的贵女下马后示意寇仲陪他避到一旁，轻轻道" -> 李秀宁 (贵女)
  if (/这大唐的贵女/.test(line) && /轻轻道/.test(line)) return "李秀宁";
  // "茫然道" after narration about 寇仲 -> 寇仲
  if (/茫然道/.test(line)) return "寇仲";
  // "连他自己也不明白" -> not a speech line (filtered by isActualDialogue)
  
  // Context overrides
  for (const [key, speaker] of Object.entries(contextSpeakers)) {
    if (line.includes(key)) return speaker;
  }
  
  // Check for speech markers with preceding names
  const markers = ["低声道", "沉声道", "厉声道", "柔声道", "苦笑道", "凄然道", "冷冷道", "淡淡道", "淡然道", "大笑道", "冷笑道", "微笑道", "仰天长笑道", "长笑道", "哑然失笑道", "问道", "喝问道", "喝道", "喊道", "叹道", "摇头道", "点头道", "问", "道", "笑"];
  markers.sort((a,b) => b.length - a.length);
  
  for (const marker of markers) {
    const markerIdx = line.indexOf(marker);
    if (markerIdx < 0) continue;
    
    const before = line.substring(0, markerIdx);
    const cleanBefore = before.replace(/[，。、""\s]*$/, "");
    
    // Find the name closest to the START of the sentence (first subject)
    // The speaker is usually the first named subject, not a name mentioned as an object
    for (const [name] of nameMap) {
      const pos = cleanBefore.indexOf(name);
      if (pos >= 0) {
        // Check if this name appears early enough to be the subject
        // and is not buried inside another phrase
        const beforeName = cleanBefore.substring(0, pos);
        const afterName = cleanBefore.substring(pos + name.length);
        
        // If name is at the very beginning or after a comma, it's likely the subject
        if (pos === 0 || /[,，。]$/.test(beforeName)) {
          // Make sure the name is not the object of another verb
          // e.g., "示意寇仲" - 寇仲 is object of 示意
          const lastVerb = beforeName.match(/(示意|看见|找到|看到|望着|看着|牵着|站在)(?:着|了)?$/);
          if (!lastVerb) {
            return name;
          }
        }
      }
    }
    
    // Fallback: rightmost name
    let bestName = null;
    let bestPos = -1;
    for (const [name] of nameMap) {
      const pos = cleanBefore.lastIndexOf(name);
      if (pos >= 0 && pos > bestPos) {
        bestName = name;
        bestPos = pos;
      }
    }
    if (bestName) return bestName;
    break;
  }
  
  // Context-based resolution for lines where speaker is implied from previous/next lines
  // Previous line mentions a character doing something, current line has a quote
  if (lineIdx > 0) {
    const prev = allLineArr[lineIdx - 1];
    // "寇仲深吸一口寒冷的空气，神智清醒了些儿，沉声道" -> 寇仲
    // "李秀宁脸庞倏地转白，凄然道" -> 李秀宁
    // "自己兄弟相斗的事实，定像个沉重的噩梦般在折磨这动人的公主，柔声道" -> 寇仲 (responding to 李秀宁)
    // "忙道" -> 寇仲 (continuation)
    // "又皱眉道" -> 徐子陵 (from prev line "徐子陵来了")
    // "悠然神往的道" -> 寇仲
    // "冷哼一声，道" -> 岳山(徐子陵)
    // "冷笑道" -> 岳山(徐子陵)
    
    for (const [name] of nameMap) {
      if (prev.includes(name)) {
        // Check if the previous line sets up this speaker
        // Pattern: "Name did something, [verb]道" where current line continues
        const nameIdx = prev.lastIndexOf(name);
        if (nameIdx >= 0) {
          const afterName = prev.substring(nameIdx + name.length);
          // If after the name there's action but no speech marker, 
          // and the current line has a speech marker, the name from prev line is the speaker
          if (!/[，。]道/.test(afterName) || afterName.match(/[，。]\s*$/)) {
            return name;
          }
        }
      }
    }
  }
  
  // Special case: "公主" in narration refers to 李秀宁, but the speaker is 寇仲
  if (/柔声道/.test(line) && /公主/.test(line)) {
    // Previous line was 李秀宁 speaking, this is 寇仲 responding
    if (lineIdx > 0) {
      const prev = allLineArr[lineIdx - 1];
      if (/李秀宁/.test(prev) || /不知道/.test(prev)) return "寇仲";
    }
  }
  
  // "忙道" without explicit speaker - continuation of 寇仲
  if (/忙道/.test(line) && lineIdx > 0) {
    const prev = allLineArr[lineIdx - 1];
    if (/寇仲/.test(prev)) return "寇仲";
    if (/李秀宁/.test(prev)) return "李秀宁";
    // If prev line is blank, look further back
    if (/^\s*$/.test(prev) && lineIdx > 1) {
      const prev2 = allLineArr[lineIdx - 2];
      if (/寇仲/.test(prev2)) return "寇仲";
    }
  }
  
  // "柔声道" in context of 寇仲 responding to 李秀宁
  if (/柔声道/.test(line)) {
    // Look back for last character mentioned (skip blank lines)
    for (let j = lineIdx - 1; j >= Math.max(0, lineIdx - 10); j--) {
      const prev = allLineArr[j];
      if (/寇仲/.test(prev)) return "寇仲";
      if (/公主/.test(prev) && /心中/.test(prev)) return "寇仲";
      if (/李秀宁/.test(prev)) return "李秀宁";
    }
  }
  
  // "又皱眉道" - continuation of 徐子陵
  if (/皱眉道/.test(line)) {
    // Look back for last character mentioned
    for (let j = lineIdx - 1; j >= Math.max(0, lineIdx - 10); j--) {
      const prev = allLineArr[j];
      if (/徐子陵/.test(prev)) return "徐子陵";
      if (/寇仲/.test(prev)) return "寇仲";
      if (/秦叔宝/.test(prev)) return "秦叔宝";
    }
  }
  
  // "悠然神往的道" - continuation of 寇仲
  if (/悠然神往/.test(line)) return "寇仲";
  
  // "冷哼一声，道" - 岳山(徐子陵)
  if (/冷哼/.test(line)) {
    // Look back for context
    for (let j = lineIdx - 1; j >= Math.max(0, lineIdx - 10); j--) {
      const prev = allLineArr[j];
      if (/杨文干/.test(prev) || /岳山/.test(prev)) return "岳山";
      if (/徐子陵/.test(prev)) return "岳山";
    }
  }
  
  // "冷笑道" - 岳山(徐子陵)
  if (/冷笑道/.test(line)) {
    for (let j = lineIdx - 1; j >= Math.max(0, lineIdx - 10); j--) {
      const prev = allLineArr[j];
      if (/杨文干/.test(prev) || /岳山/.test(prev)) return "岳山";
      if (/徐子陵/.test(prev)) return "岳山";
    }
  }
  
  return null;
}

function findTone(line) {
  if (/怒道|吼道|暴喝|大怒|怒吼/.test(line)) return "愤怒";
  if (/冷冷道|冷然道/.test(line)) return "淡然";
  if (/叹道|叹了口气/.test(line)) return "无奈";
  if (/柔声道|温柔道/.test(line)) return "温柔";
  if (/悲声道|哭道/.test(line)) return "悲伤";
  if (/大笑道|哈哈笑|狂笑|长笑道/.test(line)) return "大笑";
  if (/冷笑道/.test(line)) return "冷笑";
  if (/苦笑道/.test(line)) return "苦笑";
  if (/微笑道|微笑/.test(line)) return "微笑";
  if (/颤声道|嘶声道|沉声道|沉声/.test(line)) return "沉声";
  if (/厉声道|厉声/.test(line)) return "厉声";
  if (/急声|慌忙|焦急/.test(line)) return "焦急";
  if (/讥讽|嘲笑|戏谑/.test(line)) return "嘲讽";
  if (/恳求|哀求/.test(line)) return "恳求";
  if (/正色|认真/.test(line)) return "认真";
  if (/凄然|悲伤|伤心/.test(line)) return "悲伤";
  if (/惊|大吃一惊|愕然|大惊/.test(line)) return "惊讶";
  if (/冷哼/.test(line)) return "冷酷";
  if (/哑然失笑/.test(line)) return "微笑";
  if (/悠然/.test(line)) return "平静";
  if (/仰天长笑/.test(line)) return "大笑";
  if (/问$|追问|反问|质问/.test(line)) return "疑问";
  return "陈述";
}

function extractDialogues(segText, lineStart, segStartIdx) {
  const dialogues = [];
  const textLines = segText.split("\n");
  
  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i].trim();
    if (!line.includes('"')) continue;
    
    const absLineIdx = segStartIdx + i;
    
    // Check if this is actual dialogue vs narration with quotes
    const prevLine = absLineIdx > 0 ? lines[absLineIdx - 1] : "";
    const nextLine = absLineIdx < lines.length - 1 ? lines[absLineIdx + 1] : "";
    if (!isActualDialogue(line, prevLine, nextLine)) continue;
    
    const speakerName = findSpeaker(line, lines, absLineIdx);
    const tone = findTone(line);
    
    // Extract quoted text - find the quote after the speech marker
    // Handle lines like: "寇仲目光扫过...茫然道："柴绍呢？
    // where the first " is a closing quote from previous line
    let quoteText = null;
    
    // Find the speech marker position - prefer earliest match (closest to speaker name)
    const markers2 = ["低声道", "沉声道", "厉声道", "柔声道", "苦笑道", "凄然道", "冷冷道", "淡淡道", "淡然道", "大笑道", "冷笑道", "微笑道", "仰天长笑道", "长笑道", "哑然失笑道", "问道", "喝问道", "喝道", "喊道", "叹道", "摇头道", "点头道", "问", "道", "笑"];
    let markerPos = -1;
    let markerLen = 0;
    for (const m of markers2) {
      const idx = line.indexOf(m);
      if (idx >= 0) {
        if (markerPos < 0 || idx < markerPos) {
          markerPos = idx;
          markerLen = m.length;
        }
      }
    }
    
    if (markerPos >= 0) {
      // Find the quote AFTER the speech marker
      const afterMarker = line.substring(markerPos + markerLen);
      const qIdx = afterMarker.indexOf('"');
      if (qIdx >= 0) {
        let closeIdx = afterMarker.indexOf('"', qIdx + 1);
        if (closeIdx < 0) closeIdx = afterMarker.length;
        quoteText = afterMarker.substring(qIdx + 1, closeIdx).trim();
      }
    }
    
    if (!quoteText || quoteText.length < 2) continue;
    
    // Determine listener
    let listenerName = null;
    const listenerMatch = line.match(/对\s*([^\s，。""]{1,8})/);
    if (listenerMatch) listenerName = listenerMatch[1];
    
    // Resolve IDs
    const speakerId = speakerName ? nameMap.find(n => n[0] === speakerName) : null;
    const listenerId = listenerName ? nameMap.find(n => n[0] === listenerName) : null;
    
    dialogues.push({
      speaker: speakerId ? speakerId[1] : null,
      speaker_name: speakerName || null,
      listener: listenerId ? listenerId[1] : null,
      text: quoteText,
      tone: tone,
      chapter: 362,
      line_start: lineStart + i,
      line_end: lineStart + i
    });
  }
  
  return dialogues;
}

// Character entities
const characterEntities = [
  { id:"char_kou_zhong", name:"寇仲", alias:["少帅"], identity:"少帅军领袖，双龙之一", faction:"faction_shuai_jun", role:"protagonist", archetype:"warrior", rank:7, one_line:"少帅军领袖，与徐子陵并称双龙，豪迈果决", personality:{traits:["豪迈","果断","勇猛","重情义","机智","狂放"], speech_style:"豪放直接", temperament:"豪爽"}, relationships:[{target:"char_xu_zi_ling",type:"挚友",intensity:95,bond_level:5,dynamic:"生死之交"},{target:"char_li_xiu_ning",type:"对手",intensity:50,bond_level:2,dynamic:"情愫暗生但身份悬殊"}], known_skills:[], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:9,line_end:11,text:"寇仲目光扫过立在远处为李秀宁牵着马儿的李靖夫妇"}]},
  { id:"char_xu_zi_ling", name:"徐子陵", alias:["岳山"], identity:"双龙之一，本章扮成岳山入关", faction:"faction_shuai_jun", role:"protagonist", archetype:"warrior", rank:7, one_line:"双龙之一，沉稳内敛，本章伪装岳山潜入关中", personality:{traits:["沉稳","内敛","机敏","重义","冷静","谨慎"], speech_style:"简洁平和", temperament:"沉静"}, relationships:[{target:"char_kou_zhong",type:"挚友",intensity:95,bond_level:5,dynamic:"生死之交"}], known_skills:["skill_bao_ping_yin","skill_jing_zhong_shui_yue"], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:83,line_end:85,text:"徐子陵来了，闲聊几句"}]},
  { id:"char_li_xiu_ning", name:"李秀宁", alias:["公主","大唐贵女"], identity:"大唐公主，李渊之女，李建成的妹妹", faction:"faction_li_tang", role:"companion", archetype:"scholar", rank:3, one_line:"大唐贵女，气质高贵美丽，与寇仲有情愫但因身份悬殊而无法靠近", personality:{traits:["高贵典雅","内敛含蓄","矛盾惆怅","善良体贴","克制理性"], speech_style:"轻声细语，措辞得体", temperament:"沉静端庄"}, relationships:[{target:"char_li_jian_cheng",type:"亲属",intensity:90,bond_level:5,dynamic:"兄妹情深"},{target:"char_kou_zhong",type:"对手",intensity:50,bond_level:2,dynamic:"情愫暗生但身份悬殊"}], known_skills:[], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:3,line_end:5,text:"李秀宁衣着淡雅，玉容不施半点脂粉"}]},
  { id:"char_qin_shu_bao", name:"秦叔宝", alias:["老秦"], identity:"寇仲麾下将领", faction:"faction_shuai_jun", role:"companion", archetype:"warrior", rank:6, one_line:"寇仲麾下猛将，负责掌控战船上的郑兵", personality:{traits:["忠勇","精明","豪迈","老练","幽默"], speech_style:"直率爽朗", temperament:"豪放"}, relationships:[{target:"char_kou_zhong",type:"主仆",intensity:80,bond_level:4,dynamic:"忠心追随"}], known_skills:[], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:55,line_end:57,text:"寇仲来到船面上，找到秦叔宝"}]},
  { id:"char_li_jing", name:"李靖", alias:[], identity:"大唐名将，李秀宁之父", faction:"faction_li_tang", role:"npc", archetype:"warrior", rank:6, one_line:"大唐名将，与夫人一同护送李秀宁", personality:{traits:["英明","稳重","忠诚","有远见","军事才能出众"], speech_style:"沉稳", temperament:"内敛"}, relationships:[{target:"char_li_xiu_ning",type:"亲属",intensity:90,bond_level:5,dynamic:"父女"}], known_skills:[], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:9,line_end:10,text:"立在远处为李秀宁牵着马儿的李靖夫妇"}]},
  { id:"char_yang_wen_gan", name:"杨文干", alias:["京兆联大龙头"], identity:"京兆联龙头，庆州总管，太子党一方人士", faction:"faction_tai_zi_dang", role:"villain", archetype:"warrior", rank:6, one_line:"京兆联大龙头，人面极广，负责在关东布线眼阻止寇仲徐子陵入京", personality:{traits:["自负","精明","江湖味浓","沉稳","有野心"], speech_style:"对外恭敬对内强势", temperament:"自命不凡"}, relationships:[{target:"char_li_jian_cheng",type:"合作者",intensity:80,bond_level:4,dynamic:"太子党成员"},{target:"char_yang_xu_yan",type:"合作者",intensity:70,bond_level:3,dynamic:"联手埋伏徐子陵"}], known_skills:[], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:157,line_end:160,text:"晚辈京兆联杨文干，拜见岳老前辈"}]},
  { id:"char_yue_shan", name:"岳山", alias:["岳霸刀"], identity:"已故高手，徐子陵扮演的对象", faction:"faction_mo_men", role:"npc", archetype:"warrior", rank:6, one_line:"已故高手，熟知魔门之事，被徐子陵伪装入关", personality:{traits:["冷漠","霸道","孤傲","不怒自威","行事果决"], speech_style:"自称老夫，语气冷淡", temperament:"冷峻"}, relationships:[{target:"char_zhu_yu_yan",type:"对手",intensity:60,bond_level:3,dynamic:"曾合体交欢并生下女儿"},{target:"char_huang_gong_cuo",type:"对手",intensity:50,bond_level:2,dynamic:"被晃公错称为岳霸刀"}], known_skills:["skill_qi_sha_quan"], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:173,line_end:175,text:"你怎知老夫是岳山"}]},
  { id:"char_huang_gong_cuo", name:"晃公错", alias:["南海仙翁","晃七杀"], identity:"海南派宗师级人物", faction:"faction_nan_hai_pai", role:"villain", archetype:"warrior", rank:7, one_line:"海南派宗师，自创七杀拳，因祝玉妍之事对岳山怀恨", personality:{traits:["自负","阴狠","嫉妒心强","武功高强","表面平静内心翻涌"], speech_style:"一字一顿，语调阴沉", temperament:"外表仙风道骨内心充满仇恨"}, relationships:[{target:"char_zhu_yu_yan",type:"对手",intensity:70,bond_level:3,dynamic:"暗含妒火，疑似曾有情感纠葛"},{target:"char_yue_shan",type:"宿敌",intensity:80,bond_level:4,dynamic:"因祝玉妍之事对其恨之入骨"},{target:"char_li_jian_cheng",type:"合作者",intensity:60,bond_level:3,dynamic:"为太子党效力"}], known_skills:["skill_qi_sha_quan"], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:215,line_end:216,text:"海南派的宗师级人物南海仙翁晃公错"}]},
  { id:"char_yang_xu_yan", name:"杨虚彦", alias:["影子刺客"], identity:"建成元吉一方的顶尖高手，擅长刺杀", faction:"faction_tai_zi_dang", role:"villain", archetype:"assassin", rank:7, one_line:"影子刺客，武功极高，从后方偷袭徐子陵", personality:{traits:["神秘","冷酷","出手狠辣","善于潜伏","行事果断"], speech_style:"沉默寡言", temperament:"阴冷"}, relationships:[{target:"char_li_jian_cheng",type:"合作者",intensity:80,bond_level:4,dynamic:"太子党核心战力"},{target:"char_shi_zhi_xuan",type:"合作者",intensity:70,bond_level:3,dynamic:"共同经营谋略"}], known_skills:[], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:209,line_end:210,text:"影子刺客杨虚彦"}]},
  { id:"char_zhu_yu_yan", name:"祝玉妍", alias:[], identity:"魔门高手，岳山曾与其合体交欢并生下女儿", faction:"faction_mo_men", role:"npc", archetype:"warrior", rank:7, one_line:"魔门高手，与石之轩有情，与岳山曾有复杂关系", personality:{traits:["冷酷","深情","独立","善变","强大"], speech_style:"", temperament:""}, relationships:[{target:"char_shi_zhi_xuan",type:"恋人",intensity:90,bond_level:5,dynamic:"真正欢喜之人"},{target:"char_yue_shan",type:"对手",intensity:60,bond_level:3,dynamic:"曾合体交欢并生下女儿"}], known_skills:[], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:235,line_end:236,text:"暗含妒火，说不定晃公错与祝玉妍曾有过一段情"}]},
  { id:"char_shi_zhi_xuan", name:"石之轩", alias:[], identity:"魔门顶尖高手，祝玉妍真正喜欢的人", faction:"faction_mo_men", role:"villain", archetype:"warrior", rank:8, one_line:"魔门宗师级人物，祝玉妍的真正心意所在", personality:{traits:["深不可测","强大","神秘","冷静","城府极深"], speech_style:"", temperament:""}, relationships:[{target:"char_zhu_yu_yan",type:"恋人",intensity:90,bond_level:5,dynamic:"祝玉妍真正欢喜之人"}], known_skills:[], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:256,line_end:257,text:"她真正欢喜的人，是石之轩而非你"}]},
  { id:"char_li_shi_min", name:"李世民", alias:["秦王","李小子"], identity:"唐高祖李渊第三子，秦王", faction:"faction_li_tang", role:"companion", archetype:"warrior", rank:7, one_line:"秦王，实力强大，曾遭袭受伤", personality:{traits:["英明","果断","军事才能卓越","有远见","坚韧"], speech_style:"", temperament:""}, relationships:[{target:"char_li_jian_cheng",type:"对手",intensity:70,bond_level:3,dynamic:"兄弟争位"}], known_skills:[], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:105,line_end:107,text:"别忘记以李世民的实力，亦要遇袭受创"}]},
  { id:"char_li_jian_cheng", name:"李建成", alias:["二皇兄","太子"], identity:"唐高祖长子，太子", faction:"faction_li_tang", role:"npc", archetype:"scholar", rank:6, one_line:"太子，视寇仲徐子陵为朋友，与李世民有竞争关系", personality:{traits:["宽容","政治手腕","重视友情","有野心","优柔寡断"], speech_style:"", temperament:""}, relationships:[{target:"char_li_xiu_ning",type:"亲属",intensity:90,bond_level:5,dynamic:"兄妹"},{target:"char_li_yuan_ji",type:"亲属",intensity:85,bond_level:4,dynamic:"兄弟"},{target:"char_li_shi_min",type:"对手",intensity:70,bond_level:3,dynamic:"兄弟争位"}], known_skills:[], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:17,line_end:19,text:"你为何定要和二皇兄作对"}]},
  { id:"char_li_yuan_ji", name:"李元吉", alias:[], identity:"李建成之弟，太子党成员", faction:"faction_tai_zi_dang", role:"npc", archetype:"warrior", rank:5, one_line:"李建成之弟，太子党一方", personality:{traits:["冲动","好战","缺乏远见","自负","依附兄长"], speech_style:"", temperament:""}, relationships:[{target:"char_li_jian_cheng",type:"亲属",intensity:85,bond_level:4,dynamic:"兄弟"}], known_skills:[], related_skills:[], rag_refs:[362], source_refs:[{chapter:362,line_start:21,line_end:23,text:"还是李建成、李元吉"}]}
];

const segRanges = [[1,97],[98,194],[195,295]];

let allDialogues = [];
let allNewEntities = { characters: [], skills: [], techniques: [], factions: [], locations: [], items: [] };

for (let si = 0; si < segRanges.length; si++) {
  const seg = segRanges[si];
  const segText = lines.slice(seg[0]-1, seg[1]).join("\n");
  const dialogues = extractDialogues(segText, seg[0], seg[0]-1);
  
  allDialogues.push(...dialogues);
  
  const charIds = new Set();
  for (const d of dialogues) {
    if (d.speaker) charIds.add(d.speaker);
    if (d.listener) charIds.add(d.listener);
  }
  
  for (const charId of charIds) {
    const charData = characterEntities.find(c => c.id === charId);
    if (charData) {
      allNewEntities.characters.push(JSON.parse(JSON.stringify(charData)));
    }
  }
}

// Deduplicate dialogues
const dialogueSet = new Set();
allDialogues = allDialogues.filter(d => {
  const key = `${d.speaker||''}_${d.text}_${d.line_start}`;
  if (dialogueSet.has(key)) return false;
  dialogueSet.add(key);
  return true;
});

// Deduplicate entities
for (const [type, entities] of Object.entries(allNewEntities)) {
  const seen = new Set();
  allNewEntities[type] = entities.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

// Write progress
const progressSegments = [];
for (let si = 0; si < segRanges.length; si++) {
  const seg = segRanges[si];
  const segText = lines.slice(seg[0]-1, seg[1]).join("\n");
  const dialogues = extractDialogues(segText, seg[0], seg[0]-1);
  progressSegments.push({
    segment: si + 1, line_start: seg[0], line_end: seg[1],
    dialogues,
    new_entities: { characters: [], skills: [], techniques: [], factions: [], locations: [], items: [] },
    entity_updates: []
  });
}

fs.writeFileSync(progressFile, progressSegments.map(s => JSON.stringify(s)).join("\n") + "\n", "utf8");

const summary = "本章标题为情敌相逢，分为两条主线。寇仲在洛阳城外与李秀宁短暂告别，两人情感纠葛复杂，李秀宁希望寇仲入关后能再见一面，寇仲则需在入关寻宝与感情之间作出抉择。秦叔宝透露船上仍有王世充眼线，需抓出内奸将计就计。徐子陵扮成岳山独自在桃林客栈歇脚，遭京兆联龙头杨文干设宴拦截，暗处更有杨虚彦和晃公错埋伏。晃公错因祝玉妍之事对岳山怀恨在心，率先出手攻击。徐子陵凭借岳山遗卷的应对之法，以宝瓶印法化解七杀拳劲，随即装遁藏身桌底脱险，成功骗过三名高手。";
fs.writeFileSync(summaryFile, summary, "utf8");

const result = {
  chapter: 362,
  chapter_summary: summary,
  dialogues: allDialogues,
  new_entities: allNewEntities,
  entity_updates: []
};

const { validateChapterData } = require("/Users/admin/Site/wuxia-novel/.agents/skills/deconstruct-novel/scripts/validators");
const errors = validateChapterData(result, "ch_362.json");
if (errors.length > 0) {
  console.error("Validation errors:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), "utf8");

console.log("[完成] ch_362.json 已生成");
console.log("  段落数: " + segRanges.length);
console.log("  对话数: " + allDialogues.length);
console.log("  新实体: " + Object.values(allNewEntities).reduce((sum, arr) => sum + arr.length, 0) + " 个");
console.log("  角色: " + allNewEntities.characters.length);
console.log("  武功: " + allNewEntities.skills.length);
console.log("  招式: " + allNewEntities.techniques.length);
console.log("  势力: " + allNewEntities.factions.length);
console.log("  地点: " + allNewEntities.locations.length);
console.log("  物品: " + allNewEntities.items.length);
