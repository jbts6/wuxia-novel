const fs = require('fs');
const file = '/Users/admin/Site/wuxia-novel/黄易/大唐双龙传/ch_formatted/ch_353.md';
const content = fs.readFileSync(file, 'utf8');

// Find all quote-like characters and their unicode
var quotePositions = [];
for (var i = 0; i < content.length; i++) {
  var c = content[i];
  if (c === '"' || c === "'" || c === '\u201c' || c === '\u201d' || c === '\u2018' || c === '\u2019') {
    quotePositions.push({ pos: i, char: c, code: c.charCodeAt(0), context: content.substring(Math.max(0, i-20), i+20) });
  }
}

console.log('Total quotes found:', quotePositions.length);
for (var qi = 0; qi < Math.min(20, quotePositions.length); qi++) {
  var qp = quotePositions[qi];
  console.log('  Pos ' + qp.pos + ': char="' + qp.char + '" code=' + qp.code + ' context="' + qp.context + '"');
}

// Also check for dialogue markers
var markerPositions = [];
var markers = ['道', '问', '叹', '笑', '喝', '吟', '歌', '哂', '答', '应', '说', '曰', '对', '言', '语', '询', '诘', '责', '斥', '骂', '嘲', '讽', '讥', '谏', '哼'];
for (var mi = 0; mi < markers.length; mi++) {
  var m = markers[mi];
  var idx = content.indexOf(m);
  while (idx !== -1) {
    // Check if it's followed by a quote
    var after = content.substring(idx + 1, Math.min(idx + 5, content.length));
    if (after.includes('"') || after.includes('\u201c') || after.includes("'")) {
      markerPositions.push({ marker: m, pos: idx, context: content.substring(Math.max(0, idx-10), idx+20) });
      break; // Just find first occurrence of each marker type
    }
    idx = content.indexOf(m, idx + 1);
  }
}

console.log('\nMarker positions (first match with quote):');
for (var mpi = 0; mpi < markerPositions.length; mpi++) {
  console.log('  "' + markerPositions[mpi].marker + '" at ' + markerPositions[mpi].pos + ': "' + markerPositions[mpi].context + '"');
}
