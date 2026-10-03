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
        const prompt = `Create ONE comprehensive chapter for level: ${tahap}, subject: ${subjek}.
        Reply ONLY in valid JSON format:
        {
          "tajuk": "Bab 1: ...",
          "kandungan": "Textbook content...",
          "latihan": {
            "soalan": "Question?",
            "pilihan": ["A", "B", "C", "D"],
            "jawapan_betul": 0,
            "penjelasan": "..."
          }
        }`;
        
        const response = await ai.models.generateContent({ 
            model: 'gemini-3.8-flash', 
            contents: prompt,
            config: { responseMimeType: "application/json" } // Paksa JSON
        });
        
        let text = response.text.trim();
        // Bersihkan jika ada markdown ```json
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        try {
            const data = JSON.parse(text);
            res.json({ status: "success", data });
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError.message);
            // Fallback jika JSON rosak
            res.json({ status: "error", message: "Format data tidak sah. Cuba lagi." });
        }
    } catch (error) {
        console.error("Buku Teks Error:", error.message);
        res.status(500).json({ status: "error", message: "Gagal jana bab. Sila cuba lagi." });
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