const fs = require('fs');
const file = '/Users/admin/Site/wuxia-novel/黄易/大唐双龙传/ch_formatted/ch_353.md';
const content = fs.readFileSync(file, 'utf8');
const lineArr = content.split('\n');
const totalLines = lineArr.length;

console.log('Total lines:', totalLines);

const segments = [
  { num: 1, start: 1, end: 100 },
  { num: 2, start: 101, end: 200 },
  { num: 3, start: 201, end: totalLines }
];

const toneMap = {
  '唱道': '陈述', '轻叹道': '无奈', '叹道': '无奈',
  '微微笑道': '微笑', '心中苦笑': '苦笑', '低吟道': '无奈',
  '愕然道': '惊讶', '沉吟道': '陈述', '干笑道': '苦笑',
  '轻点头': '淡然', '默然无语': '陈述', '缓缓转身': '陈述',
  '深吸一口气': '陈述', '轻摇船橹': '淡然', '轻摇橹': '淡然',
  '微伸懒腰': '淡然', '展露': '淡然', '轻移娇躯': '淡然',
  '浅叹道': '无奈', '轻摇': '淡然',
  '道': '陈述', '说道': '陈述',
  '问': '疑问', '问道': '疑问', '追问': '疑问', '反问': '疑问',
  '质问道': '疑问', '质问': '疑问',
  '怒道': '愤怒', '吼道': '愤怒', '暴喝': '愤怒', '怒叱': '愤怒',
  '怒斥': '愤怒', '喝道': '愤怒', '喝问': '愤怒',
  '冷冷道': '淡然', '淡淡道': '淡然', '冷然道': '淡然', '冷哂': '冷笑',
  '幽幽': '无奈', '幽幽一叹': '无奈',
  '柔声': '温柔', '柔声道': '温柔', '温柔道': '温柔',
  '悲声道': '悲痛', '哭道': '悲痛',
  '大笑': '大笑', '大笑道': '大笑', '哈哈笑道': '大笑', '狂笑': '狂笑',
  '冷笑道': '冷笑', '苦笑': '苦笑', '苦笑道': '苦笑', '微笑': '微笑',
  '微笑道': '微笑',
  '颤声道': '颤声', '嘶声道': '嘶声', '沉声': '沉声', '沉声道': '沉声',
  '厉声': '厉声', '厉声道': '厉声',
  '急声道': '焦急', '慌忙道': '焦急', '慌张': '慌张', '焦急': '焦急',
  '讥讽道': '嘲讽', '嘲笑道': '嘲讽', '戏谑道': '调侃', '调侃': '调侃',
  '恳求道': '恳求', '哀求道': '恳求', '恳求': '恳求',
  '正色道': '严肃', '认真道': '严肃', '严肃': '严肃',
  '惊呼': '惊讶', '惊呼道': '惊讶',
  '恐惧': '恐惧',
  '好奇': '好奇',
  '犹豫': '犹豫',
  '欣喜': '欣喜', '开心': '欣喜',
  '娇声': '娇声', '娇笑': '娇声', '噗哧': '娇声',
  '喃喃': '低语', '喃喃道': '低语', '低语': '低语', '低声道': '低语',
  '豪迈': '豪迈', '豪放': '豪迈',
  '担心': '担心', '忧': '担心', '愁': '担心',
  '欣然': '欣喜', '轻笑': '轻笑',
  '白他': '淡然', '横他': '淡然', '瞥他': '淡然',
  '白他一眼': '淡然', '横他一眼': '淡然',
  '白他娇媚': '淡然', '横他娇媚': '淡然',
  '白他一眼后': '淡然', '横他一眼后': '淡然',
  '轻摇船橹后': '淡然', '轻摇着': '淡然',
  '答道': '陈述', '忙道': '陈述', '摇头道': '淡然',
  '沉声': '沉声', '厉声': '厉声', '颤声': '颤声', '嘶声': '嘶声'
};

const markersSorted = Object.keys(toneMap).sort(function(a, b) { return b.length - a.length; });
var markerPatternStr = markersSorted.join('|');

// Escape special regex chars in marker pattern
var escapedMarker = markerPatternStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Regex: Chinese name(s) + optional middle text + marker + optional colon + quote
// Quotes are ASCII " (code 34)
var markerRegexStr = '([\\u4e00-\\u9fff]{1,8})[\\s\\u4e00-\\u9fff\\u3000\\uff08\\uff09]{0,10}?(' + escapedMarker + ')[\\s\\u4e00-\\u9fff\\u3000]*?[\\:\\uFF1a]?\\s*"(.*?)"';

for (var si = 0; si < segments.length; si++) {
  var seg = segments[si];
  var segText = lineArr.slice(seg.start - 1, seg.end).join('\n');
  
  var markerRegex = new RegExp(markerRegexStr, 'g');
  var dialogues = [];
  var dm;
  
  while ((dm = markerRegex.exec(segText)) !== null) {
    var speakerName = dm[1].trim();
    var marker = dm[2];
    var text = dm[3].trim();
    var pos = dm.index;
    var lineOffset = segText.substring(0, pos).split('\n').length - 1;
    var tone = toneMap[marker] || '陈述';
    
    dialogues.push({
      segment: seg.num,
      line_start: seg.start + lineOffset,
      line_end: seg.start + lineOffset + 1,
      speaker_name: speakerName,
      speaker: null,
      listener: null,
      text: text,
      tone: tone
    });
  }
  
  console.log('');
  console.log('=== Segment ' + seg.num + ' (lines ' + seg.start + '-' + seg.end + ') ===');
  console.log('Dialogues found: ' + dialogues.length);
  for (var di = 0; di < dialogues.length; di++) {
    var d = dialogues[di];
    var preview = d.text.length > 60 ? d.text.substring(0, 60) + '...' : d.text;
    console.log('  L' + d.line_start + ': [' + d.tone + '] ' + d.speaker_name + ': "' + preview + '"');
  }
}
