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

app.post('/api/tanya', async (req, res) => {
    try {
        const { soalan, subjek, tahap } = req.body;
        const prompt = `You are a friendly Malaysian tutor for ${tahap}, subject: ${subjek}. 
        Question: "${soalan}". 
        Answer in Bahasa Melayu. Keep it simple. For math, show steps clearly.`;
        
        const response = await ai.models.generateContent({ model: 'gemini-3.8-flash', contents: prompt });
        res.json({ status: "success", jawapan: response.text });
    } catch (error) {
        console.error("Tanya Error:", error.message);
        res.status(500).json({ status: "error", message: "Maaf, AI sibuk." });
    }
});

app.post('/api/buku-teks', async (req, res) => {
    try {
        const { subjek, tahap } = req.body;
        const prompt = `You are a Malaysian textbook author. Create ONE chapter for level: ${tahap}, subject: ${subjek}.
        
        Reply EXACTLY in this format with these exact markers (jangan tambah apa-apa lain):
        
        ===TAJUK===
        (Tulis tajuk bab di sini)
        ===KANDUNGAN===
        (Tulis kandungan buku teks di sini. 3-4 perenggan. Bahasa Melayu. Untuk Matematik, tunjuk contoh kiraan.)
        ===SOALAN===
        (Tulis satu soalan latihan di sini)
        ===PILIHAN_A===
        (Pilihan A)
        ===PILIHAN_B===
        (Pilihan B)
        ===PILIHAN_C===
        (Pilihan C)
        ===PILIHAN_D===
        (Pilihan D)
        ===JAWAPAN===
        (Tulis A, B, C, atau D sahaja)
        ===PENJELASAN===
        (Terangkan kenapa jawapan itu betul. 1-2 ayat.)
        ===TAMAT===`;
        
        const response = await ai.models.generateContent({ 
            model: 'gemini-3.8-flash', 
            contents: prompt
        });
        
        const text = response.text;
        
        const getSection = (start, end) => {
            const startIdx = text.indexOf(start);
            const endIdx = text.indexOf(end);
            if (startIdx === -1 || endIdx === -1) return '';
            return text.substring(startIdx + start.length, endIdx).trim();
        };
        
        const tajuk = getSection('===TAJUK===', '===KANDUNGAN===');
        const kandungan = getSection('===KANDUNGAN===', '===SOALAN===');
        const soalan = getSection('===SOALAN===', '===PILIHAN_A===');
        const pilihanA = getSection('===PILIHAN_A===', '===PILIHAN_B===');
        const pilihanB = getSection('===PILIHAN_B===', '===PILIHAN_C===');
        const pilihanC = getSection('===PILIHAN_C===', '===PILIHAN_D===');
        const pilihanD = getSection('===PILIHAN_D===', '===JAWAPAN===');
        const jawapanHuruf = getSection('===JAWAPAN===', '===PENJELASAN===').toUpperCase();
        const penjelasan = getSection('===PENJELASAN===', '===TAMAT===');
        
        const jawapanIndex = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[jawapanHuruf.charAt(0)] || 0;
        
        if (!tajuk || !kandungan || !soalan) {
            console.error("Parse Error - Missing content");
            return res.status(500).json({ status: "error", message: "Gagal jana bab. Cuba lagi." });
        }
        
        res.json({ 
            status: "success", 
            data: {
                tajuk,
                kandungan,
                latihan: {
                    soalan,
                    pilihan: [pilihanA, pilihanB, pilihanC, pilihanD],
                    jawapan_betul: jawapanIndex,
                    penjelasan
                }
            }
        });
    } catch (error) {
        console.error("Buku Teks Error:", error.message);
        res.status(500).json({ status: "error", message: "Gagal jana bab. Sila cuba lagi." });
    }
});

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