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

// 1. TANYA AI
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

// 2. JANA BUKU TEKS (FORMAT TEKS - LEBIH STABIL)
app.post('/api/buku-teks', async (req, res) => {
    try {
        const { subjek, tahap } = req.body;
        console.log("Requesting textbook for:", subjek, "| Level:", tahap);
        
        const prompt = `You are a Malaysian textbook author. 
        STRICTLY create ONE short chapter for level: ${tahap}, subject: ${subjek}.
        DO NOT talk about any other subject. ONLY talk about ${subjek}.
        
        Reply EXACTLY in this format. Do not add any other text, no markdown, no asterisks.
        
        TAJUK: [Write the chapter title here]
        KANDUNGAN: [Write 3-4 paragraphs of textbook content here. Bahasa Melayu. For Math, show calculation examples.]
        SOALAN: [Write one practice question here]
        PILIHAN_A: [Option A]
        PILIHAN_B: [Option B]
        PILIHAN_C: [Option C]
        PILIHAN_D: [Option D]
        JAWAPAN: [Write only A, B, C, or D]
        PENJELASAN: [Explain why the answer is correct. 1-2 sentences.]`;
        
        const response = await ai.models.generateContent({ 
            model: 'gemini-3.8-flash', 
            contents: prompt
        });
        
        const text = response.text;
        
        const getValue = (key) => {
            const regex = new RegExp(`${key}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`, 'i');
            const match = text.match(regex);
            return match ? match[1].trim() : '';
        };
        
        const tajuk = getValue('TAJUK');
        const kandungan = getValue('KANDUNGAN');
        const soalan = getValue('SOALAN');
        const pilihanA = getValue('PILIHAN_A');
        const pilihanB = getValue('PILIHAN_B');
        const pilihanC = getValue('PILIHAN_C');
        const pilihanD = getValue('PILIHAN_D');
        const jawapanHuruf = getValue('JAWAPAN').toUpperCase();
        const penjelasan = getValue('PENJELASAN');
        
        const jawapanIndex = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[jawapanHuruf.charAt(0)] || 0;
        
        if (!tajuk || !kandungan || !soalan) {
            console.error("Parse failed for subject:", subjek);
            return res.status(500).json({ status: "error", message: "Format dari AI tidak lengkap. Sila cuba lagi." });
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