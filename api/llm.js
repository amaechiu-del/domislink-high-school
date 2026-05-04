// api/llm.js – Gemini only (working model)
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Use the same model that worked in your curl test
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
        });
        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (err) {
        console.error('Gemini error:', err);
        return res.status(500).json({ error: 'Failed to contact Gemini API' });
    }
}
