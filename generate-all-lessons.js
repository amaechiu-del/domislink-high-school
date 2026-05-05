// generate-all-lessons.js – uses Gemini (free, 1500 req/day)
const fs = require('fs').promises;
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('❌ Please set GEMINI_API_KEY environment variable');
    process.exit(1);
}

const SYLLABUS_FILE = 'syllabuses.json';
const OUTPUT_DIR = 'lessons';
const DELAY_MS = 3000;       // 3 seconds between requests

function sanitize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function getTopicId(level, exam, subject, topic) {
    return `${sanitize(level)}_${sanitize(exam)}_${sanitize(subject)}_${sanitize(topic)}`;
}

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function callGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No content in response');
    return text;
}

async function generateLesson(level, exam, subject, topic) {
    const prompt = `Generate a complete, self-contained HTML lesson (just inner content, no <html> or <body> tags) for ${level.toUpperCase()} studying "${topic}" in "${subject}" (${exam} syllabus). Include:
- an animated SVG diagram (inside <svg> tags)
- bullet-point explanations
- two Nigerian examples
- a "Fun Fact" block
- three practice questions with answers at the end.
Return ONLY the HTML fragment. Do not include any extra commentary.`;
    return await callGemini(prompt);
}

async function main() {
    console.log('📖 Reading syllabus...');
    const raw = await fs.readFile(SYLLABUS_FILE, 'utf8');
    const syllabus = JSON.parse(raw.replace(/^\uFEFF/, ''));
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const tasks = [];
    for (const [level, examData] of Object.entries(syllabus))
        for (const [exam, examContent] of Object.entries(examData))
            if (examContent.subjects)
                for (const [subject, topics] of Object.entries(examContent.subjects))
                    for (const topic of topics)
                        tasks.push({ level, exam, subject, topic });

    console.log(`📊 Total topics: ${tasks.length}`);
    let completed = 0;
    let failed = [];

    for (const t of tasks) {
        const id = getTopicId(t.level, t.exam, t.subject, t.topic);
        const filePath = path.join(OUTPUT_DIR, `${id}.html`);
        try {
            await fs.access(filePath);
            console.log(`⏭️ Skipping existing: ${id}`);
            completed++;
            continue;
        } catch {}

        console.log(`📝 Generating: ${t.level}/${t.exam}/${t.subject}/${t.topic}`);
        try {
            const html = await generateLesson(t.level, t.exam, t.subject, t.topic);
            await fs.writeFile(filePath, html, 'utf8');
            console.log(`✅ Saved: ${id}`);
        } catch (err) {
            console.error(`❌ Failed ${id}: ${err.message}`);
            failed.push(id);
        }
        completed++;
        console.log(`Progress: ${completed}/${tasks.length}`);
        await sleep(DELAY_MS);
    }

    console.log(`\n🎉 Done! Generated ${tasks.length - failed.length} lessons.`);
    if (failed.length) {
        console.log(`\n⚠️ Failed topics (${failed.length}):`);
        failed.forEach(f => console.log(`   - ${f}`));
    }
}

main().catch(console.error);
