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
        
        const prompt = `You are a friendly Malaysian tutor for students at level: ${tahap}, subject: ${subjek}.

        Student's Question: "${soalan}"

        CRITICAL RULES:
        1. Adjust difficulty according to level "${tahap}". 
           - Year 1-3: Very simple words, use pictures/candy/toys examples, very short.
           - Year 4-6: Simple explanations with examples.
           - Form 1-3: More detail, introduce concepts.
           - Form 4-5 (SPM): Exam-focused, include formulas and exam tips.
        2. Answer in Bahasa Melayu (mix with English terms if needed for Science/Math).
        3. For Math/Science: show step-by-step solution clearly.
        4. For History/Geography: give facts with context.
        5. For languages: correct grammar gently.
        6. Use emoji to make it fun for younger kids.
        7. End with an encouraging phrase.
        8. Follow Malaysian KSSR/KSSM syllabus.`;

        const response = await ai.models.generateContent({ 
            model: 'gemini-3.8-flash', 
            contents: prompt 
        });
        
        res.json({ status: "success", jawapan: response.text });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ status: "error", message: "Maaf, AI sibuk. Cuba lagi." });
    }
});

app.post('/api/soalan-rawak', async (req, res) => {
    try {
        const { subjek, tahap } = req.body;
        const prompt = `Generate ONE practice question for a Malaysian student at level: ${tahap}, subject: ${subjek}. 
        Follow the Malaysian KSSR/KSSM syllabus for that level.
        Reply ONLY with the question in Bahasa Melayu. No answer. No extra text.`;
        
        const response = await ai.models.generateContent({ 
            model: 'gemini-3.8-flash', 
            contents: prompt 
        });
        
        res.json({ status: "success", soalan: response.text.trim() });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Gagal jana soalan." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server berjalan di port ' + PORT));