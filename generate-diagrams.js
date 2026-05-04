// generate-diagrams.js
const fs = require('fs').promises;
const path = require('path');

// --- CONFIGURATION ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
const SYLLABUS_FILE = 'syllabuses.json';
const OUTPUT_DIR = 'diagrams';
const PROMISE_CONCURRENCY = 3; // generate 3 diagrams at a time

function sanitize(str) {
    return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function generateSVG(subject, topic, examBody, level) {
    const prompt = `You are an expert educational illustrator. Generate a clean, colorful, animated SVG diagram for the topic "${topic}" in subject "${subject}" for ${level.toUpperCase()} students following the ${examBody} syllabus.

Requirements:
- Return ONLY valid SVG code (no markdown, no explanations).
- Use a viewBox="0 0 800 600".
- Include CSS animations inside <style> (e.g., pulsing labels, flowing arrows, rotating parts).
- All text labels must be readable (font-size at least 14px).
- Use Nigerian or globally relevant context where appropriate.
- Background: white or transparent.

Topic context: ${topic} in ${subject}.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    let svg = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const svgMatch = svg.match(/<svg[\s\S]*?<\/svg>/i);
    if (svgMatch) svg = svgMatch[0];
    if (!svg.includes('<svg')) throw new Error('No valid SVG found in response');
    return svg;
}

async function main() {
    console.log('📖 Reading syllabus...');
    const syllabusRaw = await fs.readFile(SYLLABUS_FILE, "utf8"); const syllabusRawClean = syllabusRaw.replace(/^\uFEFF/, "");
    const syllabus = JSON.parse(syllabusRawClean);
    
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    const allDiagrams = [];
    const tasks = [];
    
    for (const [level, examData] of Object.entries(syllabus)) {
        for (const [exam, subjects] of Object.entries(examData)) {
            if (!subjects.subjects) continue;
            for (const [subject, topics] of Object.entries(subjects.subjects)) {
                for (const topic of topics) {
                    const fileName = `${sanitize(level)}_${sanitize(exam)}_${sanitize(subject)}_${sanitize(topic)}.svg`;
                    const filePath = path.join(OUTPUT_DIR, fileName);
                    tasks.push({
                        level, exam, subject, topic,
                        filePath, fileName,
                        ref: `${level}/${exam}/${subject}/${topic}`
                    });
                }
            }
        }
    }
    
    console.log(`📊 Found ${tasks.length} topics to generate diagrams for.`);
    
    let completed = 0;
    const failed = [];
    
    async function processTask(task) {
        try {
            try {
                await fs.access(task.filePath);
                console.log(`⏭️  Already exists: ${task.fileName}`);
                allDiagrams.push({
                    ref: task.ref,
                    file: `/${OUTPUT_DIR}/${task.fileName}`,
                    alt: `${task.topic} diagram`
                });
                return;
            } catch {}
            
            console.log(`🎨 Generating: ${task.level} / ${task.exam} / ${task.subject} / ${task.topic} ...`);
            const svg = await generateSVG(task.subject, task.topic, task.exam, task.level);
            await fs.writeFile(task.filePath, svg, 'utf8');
            console.log(`✅ Saved: ${task.fileName}`);
            allDiagrams.push({
                ref: task.ref,
                file: `/${OUTPUT_DIR}/${task.fileName}`,
                alt: `${task.topic} diagram`
            });
        } catch (err) {
            console.error(`❌ Failed for ${task.ref}:`, err.message);
            failed.push(task.ref);
        } finally {
            completed++;
            console.log(`Progress: ${completed}/${tasks.length}`);
        }
    }
    
    for (let i = 0; i < tasks.length; i += PROMISE_CONCURRENCY) {
        const batch = tasks.slice(i, i + PROMISE_CONCURRENCY);
        await Promise.all(batch.map(processTask));
    }
    
    await fs.writeFile(path.join(OUTPUT_DIR, 'index.json'), JSON.stringify(allDiagrams, null, 2));
    console.log(`\n📁 Index saved: ${OUTPUT_DIR}/index.json`);
    if (failed.length) {
        console.log(`\n⚠️ Failed ${failed.length} topics:`);
        failed.forEach(f => console.log(`   - ${f}`));
    } else {
        console.log('🎉 All diagrams generated successfully!');
    }
}

main().catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
});
