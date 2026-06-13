const fs = require('fs');
const path = require('path');

const chapterFile = path.join(__dirname, 'ch_formatted', 'ch_34.md');
const progressFile = path.join(__dirname, 'batch_json', 'ch_034_progress.jsonl');

const lines = fs.readFileSync(chapterFile, 'utf8').split('\n');
const totalLines = lines.length;

// Split into segments of about 100 lines
const segmentSize = 100;
const segments = [];
for (let i = 0; i < totalLines; i += segmentSize) {
    const start = i;
    const end = Math.min(i + segmentSize, totalLines);
    segments.push({ start, end });
}

// Predefined characters map (name -> id)
const charMap = {
    '独孤伤': 'char_du_gu_shang',
    '幽灵宫主': 'char_you_ling_gong_zhu',
    '幽灵鬼女': 'char_you_ling_gong_zhu', // alias
    '快活王': 'char_kuai_huo_wang',
    '可人': 'char_ke_ren',
    '沈浪': 'char_shen_lang',
    '金无望': 'char_jin_wu_wang',
    '白飞飞': 'char_bai_fei_fei',
    '小精灵': 'char_xiao_jing_ling',
    '莺儿': 'char_ying_er',
    '燕儿': 'char_yan_er',
};

// For each segment, extract dialogues and entities
const progressLines = [];
for (const seg of segments) {
    const line_start = seg.start + 1; // 1-indexed
    const line_end = seg.end;
    const segmentLines = lines.slice(seg.start, seg.end);
    const segmentText = segmentLines.join('\n');
    
    // Extract dialogues
    const dialogues = [];
    const regex = /[「""]([^「""]+)[」""]/g;
    let match;
    while ((match = regex.exec(segmentText)) !== null) {
        const text = match[1];
        const absoluteIndex = seg.start + segmentText.substring(0, match.index).split('\n').length - 1;
        const lineNum = absoluteIndex + 1;
        // Determine speaker
        const speakerName = findSpeaker(segmentText, match.index);
        const speakerId = speakerName ? (charMap[speakerName] || null) : null;
        dialogues.push({
            speaker: speakerId,
            speaker_name: speakerName,
            listener: null,
            text: text,
            tone: '陈述', // default, will adjust later
            chapter: 34,
            line_start: lineNum,
            line_end: lineNum
        });
    }
    
    // Extract new entities (simplified)
    const new_entities = { characters: [], skills: [], techniques: [], factions: [], locations: [], items: [] };
    // For now, we'll manually add entities later
    
    const segmentData = {
        segment: segments.indexOf(seg) + 1,
        line_start: line_start,
        line_end: line_end,
        dialogues: dialogues,
        new_entities: new_entities,
        entity_updates: []
    };
    progressLines.push(JSON.stringify(segmentData));
}

// Write progress file
fs.writeFileSync(progressFile, progressLines.join('\n'), 'utf8');
console.log(`Processed ${segments.length} segments, wrote ${progressLines.length} lines to ${progressFile}`);

// Helper function to find speaker (simplified)
function findSpeaker(text, matchIndex) {
    // Look backwards for speaker clues
    const before = text.substring(Math.max(0, matchIndex - 100), matchIndex);
    // Simple patterns
    const patterns = [
        /(\S+?)道/,
        /(\S+?)笑道/,
        /(\S+?)大笑道/,
        /(\S+?)冷冷道/,
        /(\S+?)沉声道/,
        /(\S+?)柔声道/,
        /(\S+?)厉声道/,
    ];
    for (const pat of patterns) {
        const m = before.match(pat);
        if (m) {
            const name = m[1];
            // Check if name is in charMap
            if (charMap[name]) return name;
        }
    }
    // Check for "只听" etc
    const listenPattern = /只听(\S+?)道/;
    const m = before.match(listenPattern);
    if (m && charMap[m[1]]) return m[1];
    return null;
}