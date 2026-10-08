import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

// ===== CONFIG =====
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Model list with fallback (in priority order)
// Menggunakan model yang masih aktif di Groq setakat Oktober 2026
const MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b"
];

// ===== SYSTEM PROMPT =====
const SYSTEM_PROMPT = `You are an experienced lecturer for the Diploma in Halal Management at UiTM (Universiti Teknologi MARA), Malaysia.
- Answer in clear, simple English.
- Keep responses concise and practical.
- Relate examples to the Malaysian halal industry when relevant.
- Use proper academic tone but stay friendly and easy to understand.`;

// ===== GROQ API CALL (with auto-fallback) =====
async function callGroq(userPrompt, options = {}) {
  if (!GROQ_KEY) {
    throw new Error("GROQ_API_KEY is missing. Set it in your .env or Railway Variables.");
  }

  const {
    temperature = 0.7,
    max_tokens = 2200
    // jsonMode dibuang buat masa ini untuk elakkan ralat pengesahan
  } = options;

  let lastError = null;

  for (const model of MODELS) {
    try {
      const body = {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        temperature,
        max_tokens
      };

      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_KEY}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message || JSON.stringify(data).slice(0, 300);

        // Jika model tidak wujud atau tiada akses, cuba model seterusnya
        if (
          msg.includes("does not exist") ||
          msg.includes("do not have access") ||
          msg.includes("decommissioned") ||
          msg.includes("not found")
        ) {
          console.warn(`[Groq] Model "${model}" unavailable, trying next...`);
          lastError = new Error(msg);
          continue;
        }

        // Ralat lain (rate limit, auth, dll) - teruskan ke model seterusnya atau throw
        throw new Error(`Groq API error (${model}): ${msg}`);
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        lastError = new Error(`Empty response from ${model}`);
        continue;
      }

      console.log(`[Groq] ✅ Success using model: ${model}`);
      return content;

    } catch (e) {
      lastError = e;
      console.warn(`[Groq] ❌ Failed with ${model}: ${e.message}`);
      continue;
    }
  }

  throw new Error(`All models failed. Last error: ${lastError?.message}`);
}

// ===== HEALTH CHECKS =====
app.get("/health", (req, res) => res.status(200).send("OK"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    groq_configured: !!GROQ_KEY,
    models: MODELS,
    primary_model: MODELS[0],
    timestamp: new Date().toISOString()
  });
});

// ===== ROOT =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ===== TEXTBOOK GENERATOR =====
app.post("/api/buku-teks", async (req, res) => {
  try {
    const { subjek, tahap } = req.body;

    if (!subjek) {
      return res.status(400).json({
        status: "error",
        message: "Field 'subjek' is required."
      });
    }

    const prompt = `
Create a short textbook chapter for the subject "${subjek}" at level "${tahap || "Diploma"}" 
for the Diploma in Halal Management program at UiTM Malaysia.

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):

{
  "tajuk": "An engaging chapter title",
  "kandungan": "3-4 concise paragraphs in English explaining the topic. Include real examples from the Malaysian halal industry. Separate paragraphs with \\n\\n.",
  "latihan": {
    "soalan": "A multiple-choice question related to the topic",
    "pilihan": ["A. first option", "B. second option", "C. third option", "D. fourth option"],
    "jawapan_betul": 0,
    "penjelasan": "Explanation of why the correct answer is right"
  }
}

Requirements:
- Language: English only
- Tone: academic but accessible
- Content: practical and relevant to halal industry
- jawapan_betul must be an index (0-3) matching the correct option
`.trim();

    const raw = await callGroq(prompt, { temperature: 0.7, max_tokens: 1800 });

    // Robust JSON extraction (tanpa bergantung pada json mode API)
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) {
      throw new Error("AI did not return valid JSON.");
    }

    const parsed = JSON.parse(cleaned.slice(start, end + 1));

    // Validate structure
    if (!parsed.tajuk || !parsed.kandungan || !parsed.latihan) {
      throw new Error("AI response is missing required fields.");
    }

    res.json({ status: "success", data: parsed });
  } catch (e) {
    console.error("[buku-teks]", e.message);
    res.status(500).json({
      status: "error",
      message: e.message
    });
  }
});

// ===== CHAT / Q&A =====
app.post("/api/tanya", async (req, res) => {
  try {
    const { soalan, subjek, tahap } = req.body;

    if (!soalan || !soalan.trim()) {
      return res.json({ jawapan: "Please type your question." });
    }

    const context = subjek ? `Subject: ${subjek} (${tahap || "Diploma"}).` : "";
    const prompt = `${context}
Student's question: "${soalan}"

Answer in simple English, maximum 150 words. Be clear and helpful. If relevant, relate your answer to the halal industry in Malaysia.`.trim();

    const jawapan = await callGroq(prompt, { temperature: 0.7, max_tokens: 500 });

    res.json({ jawapan });
  } catch (e) {
    console.error("[tanya]", e.message);
    res.status(500).json({
      jawapan: `Sorry, an error occurred: ${e.message}`
    });
  }
});

// ===== 404 FALLBACK =====
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Endpoint not found." });
});

// ===== START SERVER =====
app.listen(PORT, "0.0.0.0", () => {
  console.log("════════════════════════════════════════════");
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Groq API Key: ${GROQ_KEY ? "CONFIGURED" : "MISSING ⚠️"}`);
  console.log(`✅ Primary model: ${MODELS[0]}`);
  console.log(`✅ Fallback models: ${MODELS.slice(1).join(", ") || "(none)"}`);
  console.log("════════════════════════════════════════════");
});