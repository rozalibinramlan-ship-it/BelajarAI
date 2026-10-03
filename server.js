const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai'); 
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. TANYA AI (CHAT)
app.post('/api/tanya', async (req, res) => {
    try {
        const { soalan, subjek, tahap } = req.body;
        const prompt = `You are a friendly tutor for ${tahap}, subject: ${subjek}. 
        Question: "${soalan}". 
        Answer in Bahasa Melayu. Keep it simple. For math, show steps.`;
        
        const response = await ai.models.generateContent({ model: 'gemini-3.8-flash', contents: prompt });
        res.json({ status: "success", jawapan: response.text });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Maaf, AI sibuk." });
    }
});

// 2. JANA BUKU TEKS (BAB + LATIHAN)
app.post('/api/buku-teks', async (req, res) => {
    try {
        const { subjek, tahap } = req.body;
        const prompt = `You are a Malaysian textbook author. Create ONE comprehensive chapter for level: ${tahap}, subject: ${subjek}.
        
        Reply ONLY in this exact JSON format (no other text, no markdown):
        {
          "tajuk": "Bab 1: Tajuk Bab",
          "kandungan": "Detailed textbook content here. Use paragraphs. Explain concepts clearly. Include examples.",
          "latihan": {
            "soalan": "Question testing the chapter?",
            "pilihan": ["Option A", "Option B", "Option C", "Option D"],
            "jawapan_betul": 0,
            "penjelasan": "Why this answer is correct"
          }
        }
        
        Rules:
        - Content must be educational and easy to read.
        - Bahasa Melayu (mix English for specific terms).
        - Return ONLY JSON.`;
        
        const response = await ai.models.generateContent({ model: 'gemini-3.8-flash', contents: prompt });
        
        let text = response.text.trim();
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        const data = JSON.parse(text);
        res.json({ status: "success", data });
    } catch (error) {
        console.error("Buku Teks Error:", error.message);
        res.status(500).json({ status: "error", message: "Gagal jana bab." });
    }
});

// 3. NOTA RINGKAS
app.post('/api/nota-ringkas', async (req, res) => {
    try {
        const { topik, subjek, tahap } = req.body;
        const prompt = `Create concise study notes for ${tahap}, ${subjek}, topic: ${topik}. Format: 📌 DEFINISI, 🔑 KONSEP UTAMA, 📖 RUJUKAN, 💡 TIP PEPERIKSAAN. Bahasa Melayu.`;
        const response = await ai.models.generateContent({ model: 'gemini-3.8-flash', contents: prompt });
        res.json({ status: "success", nota: response.text });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Gagal jana nota." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server berjalan di port ' + PORT));