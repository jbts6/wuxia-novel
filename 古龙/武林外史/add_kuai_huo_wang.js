const fs = require('fs');
const path = require('path');

const progressFile = path.join(__dirname, 'batch_json', 'ch_034_progress.jsonl');
const lines = fs.readFileSync(progressFile, 'utf8').trim().split('\n').filter(Boolean);
const segments = lines.map(line => JSON.parse(line));

// Find segment 1 (segment number 1)
const seg1 = segments.find(s => s.segment === 1);
if (!seg1) {
    console.error('Segment 1 not found');
    process.exit(1);
}

// Add 快活王 character
const kuaiHuoWang = {
    id: "char_kuai_huo_wang",
    name: "快活王",
    alias: [],
    identity: "一代枭雄，统领麾下四使",
    faction: "快活王麾下",
    role: "villain",
    archetype: "warrior",
    rank: 8,
    one_line: "一代枭雄，武功高强，统领麾下四使，性格豪迈，喜爱美女。",
    personality: {
        traits: ["豪迈", "机智", "冷酷", "风流", "自信"],
        speech_style: "豪迈",
        temperament: "豪迈"
    },
    relationships: [
        {
            target: "char_shen_lang",
            type: "对手",
            intensity: 70,
            bond_level: 3,
            dynamic: "相互欣赏"
        }
    ],
    known_skills: [],
    related_skills: [],
    rag_refs: [34],
    source_refs: [
        {
            chapter: 34,
            line_start: 20,
            line_end: 20,
            text: "快活王真沉得住气，反而大笑道：'牡丹花下死，做鬼也风流……'"
        }
    ]
};

seg1.new_entities.characters.push(kuaiHuoWang);

// Write back
const updatedLines = segments.map(seg => JSON.stringify(seg));
fs.writeFileSync(progressFile, updatedLines.join('\n'), 'utf8');
console.log('Added 快活王 to segment 1');