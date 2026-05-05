// generate-quizzes.js – create quizzes.json using DeepSeek (one‑time)
const fs = require('fs').promises;
const fsSync = require('fs');
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
    console.error('❌ Please set DEEPSEEK_API_KEY environment variable');
    process.exit(1);
}
const SYLLABUS_FILE = 'syllabuses.json';
const OUTPUT_FILE = 'quizzes.json';
const DELAY_MS = 2000;

function sanitize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '_');
}
function getTopicId(level, exam, subject, topic) {
    return `${sanitize(level)}_${sanitize(exam)}_${sanitize(subject)}_${sanitize(topic)}`;
}
async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function callDeepSeek(prompt) {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 800
        })
    });
    if (!res.ok) throw new Error(`DeepSeek error: ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
}
async function generateQuiz(level, exam, subject, topic) {
    const prompt = `Generate a JSON array of 3 multiple‑choice questions about "${topic}" in "${subject}" for ${level.toUpperCase()} (${exam} syllabus). Each question: { "question": "...", "options": ["...","...","...","..."], "answerIndex": 0-3 }. Return ONLY valid JSON.`;
    const content = await callDeepSeek(prompt);
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Invalid JSON');
    return JSON.parse(match[0]);
}
async function main() {
    const raw = await fs.readFile(SYLLABUS_FILE, 'utf8');
    const syllabus = JSON.parse(raw.replace(/^\uFEFF/, ''));
    const tasks = [];
    for (const [level, examData] of Object.entries(syllabus))
        for (const [exam, examContent] of Object.entries(examData))
            if (examContent.subjects)
                for (const [subject, topics] of Object.entries(examContent.subjects))
                    for (const topic of topics)
                        tasks.push({ level, exam, subject, topic });
    console.log(`📊 Total topics: ${tasks.length}`);
    let quizzes = {};
// Load existing quizzes if file already exists
if (fsSync.existsSync(OUTPUT_FILE)) {
    try {
        const existingRaw = await fs.readFile(OUTPUT_FILE, 'utf8');
        quizzes = JSON.parse(existingRaw);
        console.log(`📂 Loaded existing quizzes: ${Object.keys(quizzes).length} entries`);
    } catch (err) {
        console.warn('⚠️ Could not parse existing quizzes.json, starting fresh');
    }
}
// Load existing quizzes if file already exists
if (fsSync.existsSync(OUTPUT_FILE)) {
    try {
        const existingRaw = await fs.readFile(OUTPUT_FILE, 'utf8');
        quizzes = JSON.parse(existingRaw);
        console.log(`📂 Loaded existing quizzes: ${Object.keys(quizzes).length} entries`);
    } catch (err) {
        console.warn('⚠️ Could not parse existing quizzes.json, starting fresh');
    }
}
    let completed = 0;
    for (const t of tasks) {const id = getTopicId(t.level, t.exam, t.subject, t.topic);
        if (quizzes.hasOwnProperty(id)) {
            console.log(`⏭️ Skipping ${id} – already exists in quizzes.json`);
            completed++;
            continue;
        }
        if (quizzes.hasOwnProperty(id)) {
            console.log(`⏭️ Skipping ${id} – already exists in quizzes.json`);
            completed++;
            continue;
        }
        if (quizzes[id]) continue;
        console.log(`📝 Generating quiz for: ${t.level}/${t.exam}/${t.subject}/${t.topic}`);
        try {
            quizzes[id] = await generateQuiz(t.level, t.exam, t.subject, t.topic);
        } catch (err) {
            console.error(`❌ Failed ${id}: ${err.message}`);
            quizzes[id] = [];
        }
        completed++;
        console.log(`Progress: ${completed}/${tasks.length}`);
        await sleep(DELAY_MS);
    }
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(quizzes, null, 2));
    console.log(`✅ Quizzes saved to ${OUTPUT_FILE}`);
}
main().catch(console.error);
