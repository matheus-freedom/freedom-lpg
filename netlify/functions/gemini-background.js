// ============================================================
// FREEDOMLPG — Background Function: gemini-background
// ------------------------------------------------------------
// Funções pesadas (generateContent, generateImage) rodam aqui.
// Background functions não têm o limite de 26s das funções
// síncronas normais — elas podem rodar por até 15 minutos.
//
// Fluxo:
//  1. Frontend chama esta função com { jobId, action, payload }
//  2. Esta função roda em background e salva o resultado no Firebase
//  3. Frontend fica em polling no Firebase até o resultado aparecer
// ============================================================

const { GoogleGenAI } = require("@google/genai");
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// ── Inicializa o Firebase Admin (uma só vez) ──────────────────
const initFirebase = () => {
  if (getApps().length > 0) return getFirestore();

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // A chave privada vem como string com \n literais — precisamos converter
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });

  return getFirestore();
};

// ── Salva o resultado do job no Firestore ─────────────────────
const saveJobResult = async (db, jobId, data) => {
  await db.collection("lpg_jobs").doc(jobId).set({
    ...data,
    completedAt: Date.now(),
  });
};

exports.handler = async (event) => {
  // Background functions não precisam de CORS nem de resposta
  // imediata — o Netlify já enviou 202 Accepted para o frontend.

  if (event.httpMethod !== "POST") return;

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    console.error("JSON inválido na background function");
    return;
  }

  const { jobId, action, payload } = body;

  if (!jobId || !action || !payload) {
    console.error("Parâmetros faltando:", { jobId, action });
    return;
  }

  const db = initFirebase();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    // ── AÇÃO: Gerar conteúdo (plano de aula, playground) ──────
    if (action === "generateContent") {
      const { contents, config } = payload;

      const model = payload.model === "gemini-2.5-pro"
        ? "gemini-2.5-pro"
        : "gemini-3.5-flash";

      const response = await ai.models.generateContent({ model, contents, config });

      await saveJobResult(db, jobId, {
        status: "done",
        text: response.text,
      });
      return;
    }

    // ── AÇÃO: Gerar imagem ─────────────────────────────────────
    if (action === "generateImage") {
      const { prompt } = payload;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{
            text: `A high-quality, professional, cinematic illustration. Style: clean, inspiring, modern. Topic: ${prompt}. DO NOT show any text, letters, UI elements, or logos.`
          }]
        },
        config: {
          imageConfig: { aspectRatio: "3:4" },
        },
      });

      let imageData = null;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageData = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      await saveJobResult(db, jobId, {
        status: "done",
        imageData,
      });
      return;
    }

    // Ação desconhecida
    await saveJobResult(db, jobId, {
      status: "error",
      error: `Ação desconhecida: ${action}`,
    });

  } catch (error) {
    console.error("Erro na background function:", error);
    await saveJobResult(db, jobId, {
      status: "error",
      error: error?.message || "Erro desconhecido",
    });
  }
};
