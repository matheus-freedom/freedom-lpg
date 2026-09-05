// ============================================================
// FREEDOMLPG — Background Function: gemini-background
// VERSÃO COM LOGS DE DIAGNÓSTICO
// ============================================================

const { GoogleGenAI, Type } = require("@google/genai");
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const initFirebase = () => {
  console.log("[STEP 1] Iniciando Firebase Admin...");
  if (getApps().length === 0) {
    console.log("[STEP 1.1] Primeira inicialização — criando app");
    console.log("[STEP 1.2] PROJECT_ID definido?", !!process.env.FIREBASE_PROJECT_ID);
    console.log("[STEP 1.3] CLIENT_EMAIL definido?", !!process.env.FIREBASE_CLIENT_EMAIL);
    console.log("[STEP 1.4] PRIVATE_KEY definido?", !!process.env.FIREBASE_PRIVATE_KEY);

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      storageBucket: `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
    });
    console.log("[STEP 1.5] App inicializado com sucesso");
  } else {
    console.log("[STEP 1.1] App já estava inicializado");
  }

  const db = getFirestore();
  const bucket = getStorage().bucket();
  console.log("[STEP 1.6] Firestore e Storage obtidos. Bucket:", bucket.name);

  return { db, bucket };
};

const saveJobResult = async (db, jobId, data) => {
  console.log(`[saveJobResult] Salvando job ${jobId} com status: ${data.status}`);
  await db.collection("lpg_jobs").doc(jobId).set({
    ...data,
    completedAt: Date.now(),
  });
  console.log(`[saveJobResult] Job ${jobId} salvo com sucesso`);
};

const uploadImageToStorage = async (bucket, base64DataUrl, jobId) => {
  console.log(`[uploadImage] Iniciando upload para job ${jobId}`);
  const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  console.log(`[uploadImage] Tamanho do buffer: ${buffer.length} bytes`);

  const filePath = `plans/temp_${jobId}/cover_image.png`;
  const file = bucket.file(filePath);
  console.log(`[uploadImage] Salvando em: ${filePath}`);

  await file.save(buffer, {
    metadata: { contentType: "image/png" },
    public: true,
  });
  console.log(`[uploadImage] file.save concluído`);

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  console.log(`[uploadImage] URL pública: ${publicUrl}`);
  return publicUrl;
};

// ============================================================
// INSPIRAÇÕES SEMANAIS
// ------------------------------------------------------------
// Gera 10 categorias × 5 propostas de aula e salva em Firestore:
//   inspirations/current          → o que o app lê (1 leitura só)
//   inspirations/week_AAAA-MM-DD  → histórico (uma cópia por geração)
//
// Quem chama:
//   • inspirations-weekly.js (agendada: domingo 18h de Brasília)
//   • gemini.js, action "generateInspirations" (botão "Gerar agora"
//     do admin na aba Inspirações)
//
// Estratégia em DUAS etapas, porque grounding (busca no Google) e
// saída JSON estruturada não convivem bem na mesma chamada:
//   1. PESQUISA  — Gemini com Google Search lista o que está em alta
//                  nesta semana (mundo + Brasil). Texto livre.
//   2. PROPOSTAS — Gemini SEM ferramentas recebe esse relatório e
//                  devolve JSON validado por schema (50 propostas).
// Se a etapa 1 falhar (cota, ferramenta indisponível), a etapa 2
// roda mesmo assim usando o conhecimento do modelo — a aba nunca
// fica vazia por causa da busca.
// ============================================================

const INSPIRATION_CATEGORIES = [
  { id: "business",        label: "Business",               emoji: "💼" },
  { id: "science-tech",    label: "Science & Technology",   emoji: "🔬" },
  { id: "health",          label: "Health",                 emoji: "🩺" },
  { id: "politics",        label: "Politics",               emoji: "🏛️" },
  { id: "culture-history", label: "Culture & History",      emoji: "🏺" },
  { id: "travel",          label: "Travel & Experiences",   emoji: "✈️" },
  { id: "trending",        label: "Trending Topics",        emoji: "🔥" },
  { id: "entertainment",   label: "Entertainment",          emoji: "🎬" },
  { id: "kids",            label: "Kids",                   emoji: "🧸" },
  { id: "teens",           label: "Teens",                  emoji: "🎧" },
];

const PROPOSALS_PER_CATEGORY = 5;
const INSPIRATIONS_MODEL = process.env.INSPIRATIONS_MODEL || "gemini-3.5-flash";

// Data de hoje no fuso de Brasília (o servidor roda em UTC).
// Brasil não tem horário de verão desde 2019, então UTC-3 é fixo.
const brazilDateISO = (ms = Date.now()) =>
  new Date(ms - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Próximo domingo às 21:00 UTC (= 18:00 em Brasília).
// Se hoje já é domingo e ainda não deu 21:00 UTC, é hoje mesmo.
const nextSundayRefreshMs = (from = Date.now()) => {
  const d = new Date(from);
  const candidate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 21, 0, 0));
  const daysUntilSunday = (7 - candidate.getUTCDay()) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + daysUntilSunday);
  if (candidate.getTime() <= from) candidate.setUTCDate(candidate.getUTCDate() + 7);
  return candidate.getTime();
};

// Etapa 1 — pesquisa com Google Search. Devolve texto livre.
const researchTrendingTopics = async (ai, todayISO) => {
  const prompt = `Today is ${todayISO}. You are a research assistant for an English school in Brazil.
Using Google Search, compile a briefing of what people are actually talking about THIS WEEK, so teachers can build conversation lessons around current topics.

Cover, with 2-4 concrete items each (name the real event/product/show/person and why it matters this week):
- Global news and politics (balanced, non-partisan framing)
- Business and economy (companies, markets, work trends)
- Science and technology (launches, discoveries, AI, gadgets)
- Health and wellbeing (studies, public health, fitness/nutrition trends)
- Culture, history anniversaries and notable dates happening this week or next
- Travel (destinations in the news, tourism trends, events)
- Entertainment (films, series, music, sports, games released or trending now)
- Kids (6-11): cartoons, animated films, toys, games, YouTube/kids creators and school-year moments popular right now
- Teens (12-17): music, gaming, social media trends, series, sports, exams and school life topics popular right now
- Brazil-specific: what Brazilians are discussing this week (news, sports, culture, viral topics)

Write plain text, one item per line, grouped by the headings above. Be specific and factual; skip anything you cannot confirm.`;

  const response = await ai.models.generateContent({
    model: INSPIRATIONS_MODEL,
    contents: [{ parts: [{ text: prompt }] }],
    config: { tools: [{ googleSearch: {} }] },
  });

  const text = response.text || "";
  console.log("[inspirations] Pesquisa concluída. Tamanho:", text.length);
  return text;
};

// Etapa 2 — transforma o briefing em 50 propostas estruturadas.
const buildProposalsSchema = () => ({
  type: Type.OBJECT,
  properties: {
    headlines: {
      type: Type.ARRAY,
      description: "5 to 6 of the hottest topics of the week, across any area.",
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING, description: "Short headline in English (max 8 words)." },
          why:   { type: Type.STRING, description: "One sentence in Brazilian Portuguese explaining why it is hot this week." },
        },
        required: ["topic", "why"],
      },
    },
    categories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "One of the category ids provided." },
          proposals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title:      { type: Type.STRING, description: "Catchy lesson title in English (max 10 words)." },
                hook:       { type: Type.STRING, description: "2 sentences in English: what the lesson is about and what the student will be able to discuss." },
                level:      { type: Type.STRING, description: "Best-fit CEFR level: A1, A2, B1, B2 or C1." },
                vocabulary: { type: Type.ARRAY, items: { type: Type.STRING }, description: "6 to 8 key words or expressions in English." },
                conversationQuestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 open conversation questions in English, level-appropriate." },
                grammarIdea: { type: Type.STRING, description: "One grammar point that fits naturally, in English (e.g. 'Second conditional')." },
                whyNow:     { type: Type.STRING, description: "One sentence in Brazilian Portuguese: why this topic is relevant now." },
                isTrending: { type: Type.BOOLEAN, description: "true if tied to a current event from the briefing; false if evergreen." },
              },
              required: ["title", "hook", "level", "vocabulary", "conversationQuestions", "grammarIdea", "whyNow", "isTrending"],
            },
          },
        },
        required: ["id", "proposals"],
      },
    },
  },
  required: ["headlines", "categories"],
});

const generateProposals = async (ai, todayISO, briefing, previousTitles) => {
  const categoryList = INSPIRATION_CATEGORIES.map(c => `- id "${c.id}": ${c.label}`).join("\n");
  const avoid = previousTitles.length
    ? `\nDO NOT repeat or lightly rephrase any of last week's lesson titles:\n${previousTitles.map(t => `- ${t}`).join("\n")}\n`
    : "";

  const prompt = `Today is ${todayISO}. You create weekly lesson inspirations for teachers at Freedom Language Center, an online English school in Brazil.
Students: Brazilian kids, teens and adults, small groups (1-5), CEFR A1-C1. The school is conversation-first: every lesson has a short reading text, a quiz and conversation points, so each proposal must be a topic people can genuinely TALK about.

${briefing ? `THIS WEEK'S BRIEFING (from web research — prefer these for trending items):\n${briefing}\n` : "No web briefing available — use your own knowledge of recurring, timeless and seasonal topics for this time of year.\n"}
CATEGORIES (produce EXACTLY ${PROPOSALS_PER_CATEGORY} proposals for EACH of the ${INSPIRATION_CATEGORIES.length}, using these exact ids):
${categoryList}

RULES
- ${INSPIRATION_CATEGORIES.length * PROPOSALS_PER_CATEGORY} proposals total, ${PROPOSALS_PER_CATEGORY} per category, no duplicates across categories.
- Within each category (except kids and teens) mix levels: at least one A1/A2, at least one B2/C1.
- Mix 2-3 trending proposals (tied to the briefing) with 2-3 evergreen ones that are interesting year-round.
- "trending" category: all 5 must be tied to this week's hottest topics (mix world + Brazil).
- "politics": civic and global issues, balanced and non-partisan; never tell students what to think.
- "health": informative and positive; no medical advice, no diet-culture or body-shaming angles.
- "kids" (ages 6-11): levels A1/A2 only; playful, concrete, game/story/song-friendly topics (animals, cartoons, toys, family, school, superheroes, food); questions a child can answer with short sentences; tie 2-3 to what kids are into right now (films, games, shows).
- "teens" (ages 12-17): levels A2-B2; identity, friendship, school, gaming, music, creators, social media, sports, future plans; respectful and never preachy; tie 2-3 to what teens are talking about this week.
- NEVER build a proposal around deaths, accidents, attacks, wars, disasters or crimes, even if they are in the briefing — pick the constructive angle (science, culture, business, sport, innovation) or skip the item. Nothing unsuitable for teens.
- Titles, hooks, vocabulary, questions and grammarIdea in ENGLISH. "whyNow" and headline "why" in BRAZILIAN PORTUGUESE.
- Vocabulary must be words a student would actually need to discuss the topic, not generic words.
${avoid}`;

  const response = await ai.models.generateContent({
    model: INSPIRATIONS_MODEL,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: buildProposalsSchema(),
    },
  });

  const raw = response.text || "";
  console.log("[inspirations] Propostas geradas. Tamanho:", raw.length);
  return JSON.parse(raw);
};

// Garante que o documento final tem as 8 categorias na ordem oficial,
// com rótulo e emoji, mesmo que o modelo tenha embaralhado ou omitido alguma.
const normalizeInspirations = (generated) => {
  const byId = new Map((generated.categories || []).map(c => [c.id, c]));
  const VALID_LEVELS = ["A1", "A2", "B1", "B2", "C1"];

  const categories = INSPIRATION_CATEGORIES.map(cat => {
    const found = byId.get(cat.id);
    const proposals = (found?.proposals || []).slice(0, PROPOSALS_PER_CATEGORY).map((p, i) => ({
      id: `${cat.id}-${i + 1}`,
      title: String(p.title || "").trim(),
      hook: String(p.hook || "").trim(),
      level: VALID_LEVELS.includes(String(p.level).toUpperCase()) ? String(p.level).toUpperCase() : "B1",
      vocabulary: Array.isArray(p.vocabulary) ? p.vocabulary.map(String).slice(0, 8) : [],
      conversationQuestions: Array.isArray(p.conversationQuestions) ? p.conversationQuestions.map(String).slice(0, 3) : [],
      grammarIdea: String(p.grammarIdea || "").trim(),
      whyNow: String(p.whyNow || "").trim(),
      isTrending: !!p.isTrending,
    }));
    return { ...cat, proposals };
  });

  const headlines = (generated.headlines || []).slice(0, 6).map(h => ({
    topic: String(h.topic || "").trim(),
    why: String(h.why || "").trim(),
  }));

  return { headlines, categories };
};

const generateInspirations = async (ai, db) => {
  const now = Date.now();
  const todayISO = brazilDateISO(now);
  console.log("[inspirations] Início. Data (BR):", todayISO, "Modelo:", INSPIRATIONS_MODEL);

  // Títulos da semana passada, para o modelo não repetir.
  let previousTitles = [];
  try {
    const prev = await db.collection("inspirations").doc("current").get();
    if (prev.exists) {
      previousTitles = (prev.data().categories || [])
        .flatMap(c => (c.proposals || []).map(p => p.title))
        .filter(Boolean);
    }
  } catch (e) {
    console.warn("[inspirations] Não consegui ler a semana anterior:", e.message);
  }

  // Etapa 1 (com fallback)
  let briefing = "";
  let groundingUsed = false;
  try {
    briefing = await researchTrendingTopics(ai, todayISO);
    groundingUsed = briefing.length > 200;
  } catch (e) {
    console.warn("[inspirations] Pesquisa com Google Search falhou, seguindo sem ela:", e.message);
  }

  // Etapa 2
  const generated = await generateProposals(ai, todayISO, briefing, previousTitles);
  const normalized = normalizeInspirations(generated);

  const total = normalized.categories.reduce((n, c) => n + c.proposals.length, 0);
  if (total < INSPIRATION_CATEGORIES.length * 3) {
    throw new Error(`Geração incompleta: só ${total} propostas válidas.`);
  }

  const docData = {
    weekId: todayISO,
    generatedAt: now,
    validUntil: nextSundayRefreshMs(now),
    model: INSPIRATIONS_MODEL,
    groundingUsed,
    ...normalized,
  };

  const col = db.collection("inspirations");
  await col.doc("current").set(docData);
  await col.doc(`week_${todayISO}`).set(docData);
  console.log(`[inspirations] Salvo: ${total} propostas, grounding=${groundingUsed}`);

  return { weekId: todayISO, total, groundingUsed };
};

exports.handler = async (event) => {
  console.log("============ NOVA REQUISIÇÃO ============");
  console.log("Método HTTP:", event.httpMethod);

  if (event.httpMethod !== "POST") {
    console.log("Método não é POST, ignorando");
    return;
  }

  let body;
  try {
    body = JSON.parse(event.body);
    console.log("Body parseado. Action:", body.action, "JobId:", body.jobId);
  } catch (e) {
    console.error("Falha ao parsear body:", e.message);
    return;
  }

  const { jobId, action } = body;
  // "generateInspirations" não precisa de payload (o prompt mora aqui no servidor);
  // as demais ações continuam exigindo.
  const payload = body.payload || {};

  if (!jobId || !action || (action !== "generateInspirations" && !body.payload)) {
    console.error("Parâmetros faltando:", { jobId, action, hasPayload: !!body.payload });
    return;
  }

  let db, bucket;
  try {
    const fb = initFirebase();
    db = fb.db;
    bucket = fb.bucket;
  } catch (e) {
    console.error("ERRO FATAL ao inicializar Firebase:", e.message);
    console.error("Stack:", e.stack);
    return;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log("GEMINI_API_KEY definida?", !!process.env.GEMINI_API_KEY);

  try {
    if (action === "generateContent") {
      console.log("[generateContent] Chamando Gemini...");
      const { contents, config } = payload;
      const model = payload.model === "gemini-2.5-pro" ? "gemini-2.5-pro" : "gemini-3.5-flash";
      console.log("[generateContent] Modelo:", model);

      const response = await ai.models.generateContent({ model, contents, config });
      console.log("[generateContent] Gemini respondeu. Tamanho do texto:", response.text?.length);

      await saveJobResult(db, jobId, {
        status: "done",
        text: response.text,
      });
      console.log("[generateContent] Job concluído com sucesso");
      return;
    }

    if (action === "generateImage") {
      console.log("[generateImage] Chamando Gemini Image...");
      const { prompt } = payload;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{
            text: `${prompt}. CRITICAL RULES: DO NOT include any text, letters, words, labels, UI elements, watermarks or logos in the image. The image must look like a real professional photograph taken by a human photographer, not like AI-generated art or digital illustration, unless explicitly specified otherwise in the style description.`
          }]
        },
        config: {
          imageConfig: { aspectRatio: "3:4" },
        },
      });
      console.log("[generateImage] Gemini Image respondeu");

      let imageUrl = null;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            console.log("[generateImage] Imagem encontrada na resposta, fazendo upload...");
            const base64DataUrl = `data:image/png;base64,${part.inlineData.data}`;
            imageUrl = await uploadImageToStorage(bucket, base64DataUrl, jobId);
            break;
          }
        }
      }

      console.log("[generateImage] imageUrl final:", imageUrl);
      await saveJobResult(db, jobId, {
        status: "done",
        imageData: imageUrl,
      });
      console.log("[generateImage] Job concluído com sucesso");
      return;
    }

    if (action === "generateInspirations") {
      console.log("[generateInspirations] Iniciando geração semanal...");
      const summary = await generateInspirations(ai, db);
      await saveJobResult(db, jobId, { status: "done", ...summary });
      console.log("[generateInspirations] Job concluído com sucesso");
      return;
    }

    console.error("Ação desconhecida:", action);
    await saveJobResult(db, jobId, {
      status: "error",
      error: `Ação desconhecida: ${action}`,
    });

  } catch (error) {
    console.error("ERRO NA EXECUÇÃO:", error.message);
    console.error("Stack:", error.stack);
    try {
      await saveJobResult(db, jobId, {
        status: "error",
        error: error?.message || "Erro desconhecido",
      });
    } catch (saveErr) {
      console.error("FALHA AO SALVAR ERRO NO FIRESTORE:", saveErr.message);
    }
  }
};
