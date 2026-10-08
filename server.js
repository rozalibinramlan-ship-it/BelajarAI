const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Root
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Health check - for UptimeRobot - DO NOT REMOVE
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        service: 'belajarai',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

let cachedModel = null;
let lastModelCheck = 0;

async function getAvailableModel() {
    // Use cache for 1 hour
    if (cachedModel && Date.now() - lastModelCheck < 3600000) {
        return cachedModel;
    }
    try {
        const res = await axios.get('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
            timeout: 10000
        });

        const models = res.data.data.map(m => m.id);
        const priority = [
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
            'qwen/qwen3-32b',
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant'
        ];

        const skipKeywords = ['whisper', 'guard', 'tts', 'playai'];
        const chatModels = models.filter(m =>
           !skipKeywords.some(k => m.toLowerCase().includes(k))
        );

        for (const p of priority) {
            if (chatModels.includes(p)) {
                cachedModel = p;
                lastModelCheck = Date.now();
                console.log(`✅ Using model: ${p}`);
                return p;
            }
        }

        cachedModel = chatModels[0];
        lastModelCheck = Date.now();
        console.log(`✅ Fallback model: ${cachedModel}`);
        return cachedModel;

    } catch (error) {
        console.error("Model detection failed:", error.message);
        // Fallback to known working model
        return cachedModel || 'llama-3.3-70b-versatile';
    }
}

async function callGroq(prompt, jsonMode = false) {
    if (!GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing in environment");
    }

    const model = await getAvailableModel();

    const payload = {
        model: model,
        messages: [
            { role: 'system', content: 'You are a helpful AI tutor. Explain clearly in English. Be friendly and educational.' },
            { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 3000
    };

    if (jsonMode) {
        payload.response_format = { type: 'json_object' };
    }

    const response = await axios.post(GROQ_URL, payload, {
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        timeout: 60000
    });

    return response.data.choices[0].message.content;
}

// API: Ask question
app.post('/api/tanya', async (req, res) => {
    try {
        const { soalan, subjek, tahap } = req.body;
        if (!soalan) {
            return res.status(400).json({ status: "error", message: "Question is required" });
        }

        const prompt = `Level: ${tahap || 'General'}, Subject: ${subjek || 'General Knowledge'}
Question: "${soalan}"

Provide detailed answer in English:
1. Clear explanation
2. Relevant examples
3. Step-by-step for Math/Science
4. 2 exam tips at the end`;

        const jawapan = await callGroq(prompt);
        res.json({ status: "success", jawapan });

    } catch (error) {
        console.error("API /tanya Error:", error.response?.data || error.message);
        res.status(500).json({ status: "error", message: "AI is busy, please try again in 10 seconds." });
    }
});

// API: Generate textbook chapter
app.post('/api/buku-teks', async (req, res) => {
    try {
        const { subjek, tahap } = req.body;

        const prompt = `Create a textbook chapter in VALID JSON for Level: ${tahap}, Subject: ${subjek}

Required JSON format:
{
  "tajuk": "Chapter title",
  "kandungan": "4-5 detailed paragraphs, minimum 300 words, in English",
  "soalan": "One exam question",
  "pilihan": ["A", "B", "C", "D"],
  "jawapan_betul": 0,
  "penjelasan": "Explanation of correct answer"
}`;

        const raw = await callGroq(prompt, true);
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleaned);

        res.json({
            status: "success",
            data: {
                tajuk: data.tajuk,
                kandungan: data.kandungan,
                latihan: {
                    soalan: data.soalan,
                    pilihan: data.pilihan,
                    jawapan_betul: data.jawapan_betul,
                    penjelasan: data.penjelasan
                }
            }
        });

    } catch (error) {
        console.error("API /buku-teks Error:", error.message);
        res.status(500).json({ status: "error", message: "Failed to generate chapter. Try again." });
    }
});

// API: Short notes
app.post('/api/nota-ringkas', async (req, res) => {
    try {
        const { topik, subjek, tahap } = req.body;

        const prompt = `Create short notes in English.
Level: ${tahap}, Subject: ${subjek}, Topic: ${topik}

Format:
📌 DEFINITION
🔑 KEY POINTS (5 points)
📖 EXAMPLE
💡 EXAM TIPS (3 tips)`;

        const nota = await callGroq(prompt);
        res.json({ status: "success", nota });

    } catch (error) {
        console.error("API /nota-ringkas Error:", error.message);
        res.status(500).json({ status: "error", message: "Failed to generate notes." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ belajarai running on port ${PORT}`));