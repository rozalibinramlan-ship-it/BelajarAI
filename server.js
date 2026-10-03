const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ==========================================
// AUTO-DETECT MODEL YANG TERSEDIA DI GROQ
// ==========================================
let cachedModel = null;

async function getAvailableModel() {
    if (cachedModel) return cachedModel;
    
    try {
        console.log("Mencari model tersedia di Groq...");
        const res = await axios.get('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }
        });
        
        // Senarai model yang tersedia
        const models = res.data.data.map(m => m.id);
        console.log("Model tersedia:", models.join(', '));
        
        // Pilih model yang sesuai (utamakan yang besar/versatile)
        const priority = [
            'llama-3.3-70b-versatile',
            'llama-3.1-70b-versatile',
            'llama3-70b-8192',
            'llama-3.1-8b-instant',
            'llama3-8b-8192',
            'mixtral-8x7b-32768',
            'gemma2-9b-it'
        ];
        
        for (const p of priority) {
            if (models.includes(p)) {
                console.log("Model dipilih:", p);
                cachedModel = p;
                return p;
            }
        }
        
        // Kalau tak ada yang match priority, ambil je yang pertama
        if (models.length > 0) {
            console.log("Fallback ke model:", models[0]);
            cachedModel = models[0];
            return models[0];
        }
        
        throw new Error("Tiada model tersedia di Groq");
    } catch (error) {
        console.error("Gagal detect model:", error.message);
        throw error;
    }
}

async function callGroq(prompt, jsonMode = false) {
    if (!GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY tidak dijumpai dalam Environment");
    }
    
    const model = await getAvailableModel();
    
    const body = {
        model: model,
        messages: [
            { role: 'system', content: 'You are a helpful, friendly Malaysian tutor. Answer in Bahasa Melayu.' },
            { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 3000
    };
    
    if (jsonMode) {
        body.response_format = { type: 'json_object' };
    }
    
    const response = await axios.post(GROQ_URL, body, {
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        timeout: 90000
    });
    
    return response.data.choices[0].message.content;
}

// 1. TANYA AI
app.post('/api/tanya', async (req, res) => {
    try {
        const { soalan, subjek, tahap } = req.body;
        const prompt = `Tutor untuk ${tahap}, subjek: ${subjek}.
        
Soalan pelajar: "${soalan}"

Beri jawapan DETAIL dalam Bahasa Melayu:
- Terangkan konsep dengan jelas
- Beri contoh relevan
- Untuk Matematik/Sains: tunjuk langkah pengiraan
- Tambah tip peperiksaan di akhir`;
        
        const jawapan = await callGroq(prompt);
        res.json({ status: "success", jawapan });
    } catch (error) {
        console.error("Tanya Error:", error.message);
        res.status(500).json({ status: "error", message: "AI sibuk. Cuba lagi." });
    }
});

// 2. BUKU TEKS
app.post('/api/buku-teks', async (req, res) => {
    try {
        const { subjek, tahap } = req.body;
        console.log("Subjek:", subjek, "| Tahap:", tahap);

        const prompt = `You are a Malaysian textbook author. Create ONE comprehensive chapter for level: ${tahap}, subject: ${subjek}.

Respond in VALID JSON with this structure:
{
  "tajuk": "Chapter title",
  "kandungan": "Write 4-5 DETAILED paragraphs explaining the concept thoroughly. Include: (1) Introduction and definition, (2) Key concepts with examples, (3) Real-world applications, (4) Formulas/rules for Math/Science, (5) Summary. Bahasa Melayu. Minimum 300 words.",
  "soalan": "Create ONE exam-style practice question",
  "pilihan": ["Option A", "Option B", "Option C", "Option D"],
  "jawapan_betul": 0,
  "penjelasan": "Detailed explanation (2-3 sentences) why the answer is correct."
}

RULES:
- Content must be DETAILED (minimum 300 words)
- Focus ONLY on subject: ${subjek}
- Academic Bahasa Melayu
- jawapan_betul must be index (0, 1, 2, or 3)`;

        const responseText = await callGroq(prompt, true);
        console.log("AI Response length:", responseText.length);
        
        let text = responseText.trim();
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        const data = JSON.parse(text);
        
        if (!data.tajuk || !data.kandungan || !data.soalan) {
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

// 3. NOTA RINGKAS
app.post('/api/nota-ringkas', async (req, res) => {
    try {
        const { topik, subjek, tahap } = req.body;
        const prompt = `Nota ringkas untuk ${tahap}, subjek ${subjek}, topik: ${topik}.
        
Format Bahasa Melayu:
📌 DEFINISI
🔑 KONSEP UTAMA (4-5 poin)
📖 RUJUKAN
💡 TIP PEPERIKSAAN (3 tip)`;
        
        const nota = await callGroq(prompt);
        res.json({ status: "success", nota });
    } catch (error) {
        console.error("Nota Error:", error.message);
        res.status(500).json({ status: "error", message: "Gagal jana nota." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server berjalan di port ' + PORT));