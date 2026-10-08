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

const GROQ_KEY = process.env.GROQ_API_KEY;
const MODEL = "llama-3.1-8b-instant";

async function callGroq(prompt){
  if(!GROQ_KEY) throw new Error("GROQ_API_KEY tiada di env - set di Railway Variables");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${GROQ_KEY}`
    },
    body:JSON.stringify({
      model:MODEL,
      messages:[
        {role:"system", content:"Kau adalah pensyarah Diploma Pengurusan Halal UiTM. Jawab padat, bahasa Melayu mudah faham."},
        {role:"user", content:prompt}
      ],
      temperature:0.7,
      max_tokens:2200
    })
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error?.message || JSON.stringify(data).slice(0,300));
  return data.choices?.[0]?.message?.content || "";
}

// Health untuk Railway
app.get("/health",(req,res)=>res.status(200).send("OK"));
app.get("/api/health",(req,res)=>res.json({status:"ok", groq:!!GROQ_KEY, model:MODEL}));

app.get("/",(req,res)=>res.sendFile(path.join(__dirname,"index.html")));

app.post("/api/buku-teks", async (req,res)=>{
  try{
    const {subjek,tahap} = req.body;
    if(!subjek) return res.status(400).json({status:"error",message:"subjek tiada"});
    
    const prompt = `
Buat buku teks ringkas subjek ${subjek} tahap ${tahap} Diploma Pengurusan Halal.
Balas JSON SAHAJA tanpa markdown code block, format mesti valid JSON:
{
  "tajuk": "Tajuk bab menarik",
  "kandungan": "3-4 perenggan penjelasan padat, bahasa Melayu, bagi contoh industri halal Malaysia. Gunakan perenggan baru.",
  "latihan": {
    "soalan": "Soalan objektif berkaitan topik",
    "pilihan": ["A. pilihan 1","B. pilihan 2","C. pilihan 3","D. pilihan 4"],
    "jawapan_betul": 0,
    "penjelasan": "Kenapa jawapan betul"
  }
}
`.trim();

    let text = await callGroq(prompt);
    text = text.replace(/```json|```/g,"").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonStr = text.slice(start, end+1);
    const parsed = JSON.parse(jsonStr);
    res.json({status:"success", data:parsed});
  }catch(e){
    console.error("buku-teks:",e.message);
    res.status(500).json({status:"error", message:e.message});
  }
});

app.post("/api/tanya", async (req,res)=>{
  try{
    const {soalan,subjek,tahap} = req.body;
    if(!soalan) return res.json({jawapan:"Sila taip soalan"});
    const prompt = `Subjek ${subjek} ${tahap}. Soalan pelajar: ${soalan}. Jawab ringkas max 150 perkataan, bahasa Melayu santai, kaitkan dengan halal industri jika relevan.`;
    const jawapan = await callGroq(prompt);
    res.json({jawapan});
  }catch(e){
    console.error("tanya:",e.message);
    res.status(500).json({jawapan:"Maaf ralat: "+e.message});
  }
});

app.listen(PORT,"0.0.0.0",()=>{
  console.log(`✅ Grey Gold App jalan di ${PORT}`);
  console.log(`✅ GROQ_KEY: ${GROQ_KEY ? "ADA" : "TIADA"}`);
});