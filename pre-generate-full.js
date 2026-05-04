// pre-generate-full.js - Rate‑limited, resumable generation
const fs = require('fs').promises;
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_KEY';
const SYLLABUS_FILE = 'syllabuses.json';
const OUTPUT = { lessons: 'lessons', videos: 'videos', quizzes: 'quizzes' };
const DELAY_MS = 1500;          // 1.5 seconds between requests
const MAX_RETRIES = 3;

function sanitize(s) { return s.replace(/[^a-z0-9]/gi, '_').toLowerCase(); }
function topicId(lvl, exam, subj, topic) {
    return `${sanitize(lvl)}_${sanitize(exam)}_${sanitize(subj)}_${sanitize(topic)}`;
}

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function callGemini(prompt, retry = 0) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (res.status === 429) {
            if (retry < MAX_RETRIES) {
                const delay = (retry + 1) * 2000;
                console.log(`⚠️ Rate limit, retrying in ${delay/1000}s... (attempt ${retry+1})`);
                await sleep(delay);
                return callGemini(prompt, retry + 1);
            } else {
                throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries`);
            }
        }
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
        if (retry < MAX_RETRIES) {
            const delay = (retry + 1) * 2000;
            console.log(`⚠️ Error: ${err.message}, retrying in ${delay/1000}s...`);
            await sleep(delay);
            return callGemini(prompt, retry + 1);
        }
        throw err;
    }
}

async function generateLesson(level, exam, subject, topic) {
    const prompt = `Generate a complete, self-contained HTML lesson (just inner content, no <html> or <body>) for ${level.toUpperCase()} studying "${topic}" in "${subject}" (${exam} syllabus). Include:
- animated SVG diagram
- bullet-point explanations
- two Nigerian examples
- a "Fun Fact"
- three practice questions with answers at the end.
Return ONLY the HTML fragment.`;
    return await callGemini(prompt);
}

async function generateVideo(level, exam, subject, topic) {
    const prompt = `Return ONLY a YouTube URL of the best educational video for "${topic}" for ${level.toUpperCase()} (${exam} syllabus). Prefer Nigerian channels.`;
    let url = await callGemini(prompt);
    if (!url.startsWith('http')) url = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${topic} ${level} lesson`)}`;
    return url;
}

async function generateQuiz(level, exam, subject, topic) {
    const prompt = `Generate a JSON array of 3 multiple-choice questions about "${topic}" for ${level.toUpperCase()} (${exam} syllabus). Each object: { "question": "...", "options": ["...","...","...","..."], "answerIndex": 0-3 }. Return ONLY valid JSON.`;
    const raw = await callGemini(prompt);
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
}

async function main() {
    const raw = await fs.readFile(SYLLABUS_FILE, 'utf8');
    const syllabus = JSON.parse(raw.replace(/^\uFEFF/, ''));
    for (const d of Object.values(OUTPUT)) await fs.mkdir(d, { recursive: true });

    // Collect all tasks
    const tasks = [];
    for (const [level, examData] of Object.entries(syllabus))
        for (const [exam, subjects] of Object.entries(examData))
            if (subjects.subjects)
                for (const [subject, topics] of Object.entries(subjects.subjects))
                    for (const topic of topics)
                        tasks.push({ level, exam, subject, topic, id: topicId(level, exam, subject, topic) });

    console.log(`📊 Total topics: ${tasks.length}`);
    let completed = 0;

    // Process one by one
    for (const t of tasks) {
        const lessonPath = `${OUTPUT.lessons}/${t.id}.html`;
        try {
            await fs.access(lessonPath);
            console.log(`⏭️ Already exists: ${t.id}`);
            completed++;
            continue;
        } catch {}

        console.log(`📝 Generating: ${t.level}/${t.exam}/${t.subject}/${t.topic}`);
        try {
            const [lesson, video, quiz] = await Promise.all([
                generateLesson(t.level, t.exam, t.subject, t.topic),
                generateVideo(t.level, t.exam, t.subject, t.topic),
                generateQuiz(t.level, t.exam, t.subject, t.topic)
            ]);
            await fs.writeFile(lessonPath, lesson, 'utf8');
            await fs.writeFile(`${OUTPUT.videos}/${t.id}.json`, JSON.stringify({ url: video }, null, 2), 'utf8');
            await fs.writeFile(`${OUTPUT.quizzes}/${t.id}.json`, JSON.stringify(quiz, null, 2), 'utf8');
            console.log(`✅ Saved: ${t.id}`);
        } catch (err) {
            console.error(`❌ Failed ${t.id}: ${err.message}`);
        }
        completed++;
        console.log(`Progress: ${completed}/${tasks.length}`);
        // Wait between requests to avoid rate limits
        await sleep(DELAY_MS);
    }
    console.log('🎉 Pre‑generation finished!');
}

main().catch(console.error);
