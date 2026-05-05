// generate-videos.js – ask DeepSeek for YouTube URL per topic
const fs = require('fs').promises;
const path = require('path');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
    console.error('❌ Please set DEEPSEEK_API_KEY environment variable');
    process.exit(1);
}

const SYLLABUS_FILE = 'syllabuses.json';
const OUTPUT_FILE = 'videos.json';
const DELAY_MS = 2000;

function sanitize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function getTopicId(level, exam, subject, topic) {
    return `${sanitize(level)}_${sanitize(exam)}_${sanitize(subject)}_${sanitize(topic)}`;
}

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function callDeepSeek(prompt) {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 200
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

async function getVideoUrl(level, exam, subject, topic) {
    const prompt = `Return ONLY the full YouTube URL of the best educational video for "${topic}" in "${subject}" for ${level.toUpperCase()} students following the ${exam} syllabus. Prefer Nigerian channels (e.g., "JAMB Preparatory", "Nigerian Educational TV", "BECE Prep"). If nothing specific, return a general search URL: https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " " + level + " lesson")}. Return just the URL, no extra text.`;
    let url = await callDeepSeek(prompt);
    if (!url.startsWith('http')) {
        url = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${topic} ${level} lesson`)}`;
    }
    return url;
}

async function main() {
    console.log('📖 Reading syllabus...');
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
    let videos = {};
    let completed = 0;

    for (const t of tasks) {
        const id = getTopicId(t.level, t.exam, t.subject, t.topic);
        if (videos[id]) {
            console.log(`⏭️ Skipping existing: ${id}`);
            completed++;
            continue;
        }
        console.log(`🔍 Fetching video for: ${t.level}/${t.exam}/${t.subject}/${t.topic}`);
        try {
            const url = await getVideoUrl(t.level, t.exam, t.subject, t.topic);
            videos[id] = url;
            console.log(`✅ Mapped: ${id} → ${url.substring(0, 60)}...`);
        } catch (err) {
            console.error(`❌ Failed ${id}: ${err.message}`);
            videos[id] = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t.topic} ${t.level} lesson`)}`;
        }
        completed++;
        console.log(`Progress: ${completed}/${tasks.length}`);
        await sleep(DELAY_MS);
    }

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(videos, null, 2), 'utf8');
    console.log(`\n🎉 Done! Video mapping saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
