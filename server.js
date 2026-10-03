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

// ==========================================
// 1. TANYA AI (JAWAPAN DETAIL)
// ==========================================
app.post('/api/tanya', async (req, res) => {
    try {
        const { soalan, subjek, tahap } = req.body;
        const prompt = `You are a friendly Malaysian tutor for ${tahap}, subject: ${subjek}. 
        Question: "${soalan}". 
        
        Give a DETAILED answer in Bahasa Melayu:
        - Explain the concept clearly.
        - Give examples where relevant.
        - For Math/Science: show step-by-step calculations.
        - Include exam tips at the end.
        - Be encouraging.`;
        
        const response = await ai.models.generateContent({ 
            model: 'gemini-3.8-flash', 
            contents: prompt 
        });
        res.json({ status: "success", jawapan: response.text });
    } catch (error) {
        console.error("Tanya Error:", error.message);
        res.status(500).json({ status: "error", message: "AI sibuk. Cuba lagi." });
    }
});

// ==========================================
// 2. BUKU TEKS (DETAIL + JSON MODE)
// ==========================================
app.post('/api/buku-teks', async (req, res) => {
    try {
        const { subjek, tahap } = req.body;
        console.log("Subjek diminta:", subjek, "| Tahap:", tahap);

        const prompt = `You are a Malaysian textbook author writing for students at level: ${tahap}, subject: ${subjek}.

Create ONE comprehensive chapter. Make the content RICH, DETAILED, and EDUCATIONAL.

Respond in VALID JSON with this exact structure:

{
  "tajuk": "Chapter title (e.g., Bab 1: Introduction to [Topic])",
  "kandungan": "Write 4-5 DETAILED paragraphs explaining the concept thoroughly. Include: (1) Introduction and definition, (2) Key concepts explained with examples, (3) Real-world applications, (4) Important formulas/rules (for Math/Science), (5) Summary. Use Bahasa Melayu. Be educational and thorough. Minimum 300 words.",
  "soalan": "Create ONE exam-style practice question that tests understanding",
  "pilihan": ["Option A text", "Option B text", "Option C text", "Option D text"],
  "jawapan_betul": 0,
  "penjelasan": "Detailed explanation (2-3 sentences) of why the correct answer is right and why others are wrong."
}

RULES:
- Content must be DETAILED and educational (minimum 300 words for "kandungan")
- Focus ONLY on subject: ${subjek}
- Use proper academic Bahasa Melayu (mix English terms where standard)
- Include real examples that students can relate to
- jawapan_betul must be the index (0, 1, 2, or 3)`;

        const response = await ai.models.generateContent({ 
            model: 'gemini-3.8-flash', 
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });
        
        let text = response.text.trim();
        console.log("AI Response length:", text.length);
        
        // Buang markdown jika ada
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        const data = JSON.parse(text);
        
        // Validate
        if (!data.tajuk || !data.kandungan || !data.soalan) {
            console.error("Data tidak lengkap:", data);
            throw new Error("Data tidak lengkap");
        }
        
        res.json({ 
            status: "success", 
            data: {
                tajuk: data.tajuk,
                kandungan: data.kandungan,
                latihan: {
                    soalan: data.soalan,
                    pilihan: data.pilihan || ['A', 'B', 'C', 'D'],
                    jawapan_betul: data.jawapan_betul || 0,
                    penjelasan: data.penjelasan || ''
                }
            }
        });
    } catch (error) {
        console.error("Buku Teks Error:", error.message);
        res.status(500).json({ status: "error", message: "Gagal jana bab. Sila cuba lagi." });
    }
});

// ==========================================
// 3. NOTA RINGKAS (DETAIL)
// ==========================================
app.post('/api/nota-ringkas', async (req, res) => {
    try {
        const { topik, subjek, tahap } = req.body;
        const prompt = `Create DETAILED study notes for ${tahap}, ${subjek}, topic: ${topik}.
        
        Format in Bahasa Melayu:
        📌 DEFINISI - Clear definition
        🔑 KONSEP UTAMA - 4-5 key points with explanations
        📖 RUJUKAN - Quran/Hadith/Standard/Act references
        💡 TIP PEPERIKSAAN - 3 exam tips
        📝 CONTOH SOALAN - One example question
        
        Be thorough and educational.`;
        
        const response = await ai.models.generateContent({ 
            model: 'gemini-3.8-flash', 
            contents: prompt 
        });
        res.json({ status: "success", nota: response.text });
    } catch (error) {
        console.error("Nota Error:", error.message);
        res.status(500).json({ status: "error", message: "Gagal jana nota." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server berjalan di port ' + PORT));