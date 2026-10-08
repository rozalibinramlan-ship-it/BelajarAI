import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Gemini Config
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.0-flash";

async function callGemini(prompt){
  if(!GEMINI_KEY) throw new Error("GEMINI_API_KEY tiada di env");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{temperature:0.7,maxOutputTokens:2000}
    })
  });
  const data = await res.json();
  if(!res.ok) throw new Error(JSON.stringify(data).slice(0,300));
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// --- WAJIB UNTUK RAILWAY HEALTHCHECK ---
app.get("/health",(req,res)=>{
  res.status(200).send("OK");
});
app.get("/api/health",(req,res)=>{
  res.json({status:"ok", time:new Date().toISOString()});
});

app.get("/",(req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
});

// API Buku Teks
app.post("/api/buku-teks", async (req,res)=>{
  try{
    const {subjek,tahap} = req.body;
    if(!subjek) return res.status(400).json({status:"error",message:"subjek tiada"});

    const prompt = `
Anda adalah pakar akademik Diploma Pengurusan Halal UiTM.
Hasilkan buku teks ringkas untuk subjek ${subjek} tahap ${tahap}.
Balas JSON SAHAJA tanpa markdown code block, format:
{
  "tajuk": "Tajuk bab menarik",
  "kandungan": "3-4 perenggan penjelasan padat, bahasa Melayu mudah faham, beri contoh industri halal Malaysia, struktur jelas",
  "latihan": {
    "soalan": "Soalan objektif berkaitan topik",
    "pilihan": ["A. pilihan 1","B. pilihan 2","C. pilihan 3","D. pilihan 4"],
    "jawapan_betul": 0,
    "penjelasan": "Penjelasan kenapa jawapan betul"
  }
}
    `.trim();

    const text = await callGemini(prompt);
    const clean = text.replace(/```json|```/g,"").trim();
    const parsed = JSON.parse(clean);
    res.json({status:"success",data:parsed});
  }catch(e){
    console.error("buku-teks error:",e.message);
    res.status(500).json({status:"error",message:e.message});
  }
});

// API Tanya AI
app.post("/api/tanya", async (req,res)=>{
  try{
    const {soalan,subjek,tahap} = req.body;
    if(!soalan) return res.status(400).json({jawapan:"Soalan kosong"});

    const prompt = `
Anda adalah AI Tutor Diploma Pengurusan Halal UiTM yang mesra dan pakar.
Subjek: ${subjek}
Tahap: ${tahap}
Soalan pelajar: ${soalan}

Jawab ringkas (max 150 patah kata), padat, bahasa Melayu santai, beri contoh industri halal jika relevan. Jika soalan luar subjek, tetap jawab tapi kaitkan dengan halal.
    `.trim();

    const jawapan = await callGemini(prompt);
    res.json({jawapan});
  }catch(e){
    console.error("tanya error:",e.message);
    res.status(500).json({jawapan:"Maaf, ralat server: "+e.message});
  }
});

app.listen(PORT, "0.0.0.0", ()=>{
  console.log(`✅ Server jalan di http://0.0.0.0:${PORT}`);
  console.log(`✅ Health check: /health`);
});