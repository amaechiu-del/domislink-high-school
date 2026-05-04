// pre-generate-deepseek.js – Use DeepSeek API (OpenAI-compatible)
const fs = require('fs').promises;
const path = require('path');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY environment variable not set');
    process.exit(1);
}

const SYLLABUS_FILE = 'syllabuses.json';
const OUTPUT = { lessons: 'lessons', videos: 'videos', quizzes: 'quizzes' };
const DELAY_MS = 500;          // 0.5 seconds between requests (DeepSeek can handle more, but be gentle)
const MAX_RETRIES = 2;

function sanitize(s) { return s.replace(/[^a-z0-9]/gi, '_').toLowerCase(); }
function topicId(lvl, exam, subj, topic) {
    return `${sanitize(lvl)}_${sanitize(exam)}_${sanitize(subj)}_${sanitize(topic)}`;
}

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function callDeepSeek(prompt, retry = 0) {
    const url = 'https://api.deepseek.com/chat/completions';
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 4000
            })
        });
        if (!res.ok) {
            if (res.status === 429) {
                if (retry < MAX_RETRIES) {
                    const delay = (retry + 1) * 2000;
                    console.log(`⚠️ Rate limit, retrying in ${delay/1000}s... (attempt ${retry+1})`);
                    await sleep(delay);
                    return callDeepSeek(prompt, retry + 1);
                } else {
                    throw new Error('Rate limit exceeded after retries');
                }
            }
            throw new Error(`API error: ${res.status} ${await res.text()}`);
        }
        const data = await res.json();
        return data.choices[0].message.content;
    } catch (err) {
        if (retry < MAX_RETRIES) {
            const delay = (retry + 1) * 2000;
            console.log(`⚠️ Error: ${err.message}, retrying in ${delay/1000}s...`);
            await sleep(delay);
            return callDeepSeek(prompt, retry + 1);
        }
        throw err;
    }
}

async function generateLesson(level, exam, subject, topic) {
    const prompt = `Generate a complete, self-contained HTML lesson (just inner content, no <html> or <body>) for ${level.toUpperCase()} studying "${topic}" in "${subject}" (${exam} syllabus). Include:
- an animated SVG diagram (inside <svg> tags)
- bullet-point explanations
- two Nigerian examples
- a "Fun Fact" block
- three practice questions with answers at the end.
Return ONLY the HTML fragment. Do not include any extra commentary.`;
    return await callDeepSeek(prompt);
}

async function generateVideo(level, exam, subject, topic) {
    const prompt = `Return ONLY a YouTube URL of the best educational video for "${topic}" for ${level.toUpperCase()} (${exam} syllabus). Prefer Nigerian channels. Return just the URL, nothing else.`;
    let url = await callDeepSeek(prompt);
    if (!url.startsWith('http')) url = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${topic} ${level} lesson`)}`;
    return url;
}

async function generateQuiz(level, exam, subject, topic) {
    const prompt = `Generate a JSON array of 3 multiple-choice questions about "${topic}" for ${level.toUpperCase()} (${exam} syllabus). Each object must have: "question", "options" (array of 4 strings), "answerIndex" (0-3). Return ONLY valid JSON. Do not include any other text.`;
    const raw = await callDeepSeek(prompt);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Invalid JSON response');
    return JSON.parse(match[0]);
}

async function main() {
    console.log('📖 Reading syllabus...');
    const raw = await fs.readFile(SYLLABUS_FILE, 'utf8');
    const syllabus = JSON.parse(raw.replace(/^\uFEFF/, ''));
    for (const d of Object.values(OUTPUT)) await fs.mkdir(d, { recursive: true });

    const tasks = [];
    for (const [level, examData] of Object.entries(syllabus))
        for (const [exam, subjects] of Object.entries(examData))
            if (subjects.subjects)
                for (const [subject, topics] of Object.entries(subjects.subjects))
                    for (const topic of topics)
                        tasks.push({ level, exam, subject, topic, id: topicId(level, exam, subject, topic) });

    console.log(`📊 Total topics: ${tasks.length}`);
    let completed = 0;

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
        await sleep(DELAY_MS);
    }
    console.log('🎉 Pre‑generation finished!');
}

main().catch(console.error);
