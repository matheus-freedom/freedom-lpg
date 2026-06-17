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
//  3. Frontend fica em polling no Firestore até o resultado aparecer
//
// IMPORTANTE — Imagens:
//  Imagens em base64 podem passar de 1MB, estourando o limite
//  do Firestore por documento. Por isso, a imagem é salva no
//  Firebase Storage e apenas a URL (pequena) vai para o Firestore.
// ============================================================

const { GoogleGenAI } = require("@google/genai");
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

// ── Inicializa o Firebase Admin (uma só vez) ──────────────────
const initFirebase = () => {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      storageBucket: `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
    });
  }

  return {
    db: getFirestore(),
    bucket: getStorage().bucket(),
  };
};

// ── Salva o resultado do job no Firestore ─────────────────────
const saveJobResult = async (db, jobId, data) => {
  await db.collection("lpg_jobs").doc(jobId).set({
    ...data,
    completedAt: Date.now(),
  });
};

// ── Faz upload de imagem base64 para o Storage ────────────────
// Salva o arquivo como público e retorna a URL direta.
// URL pública não requer permissão de assinatura — mais simples e confiável.
const uploadImageToStorage = async (bucket, base64DataUrl, jobId) => {
  const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  const filePath = `plans/temp_${jobId}/cover_image.png`;
  const file = bucket.file(filePath);

  // public: true torna o arquivo acessível sem autenticação
  await file.save(buffer, {
    metadata: { contentType: "image/png" },
    public: true,
  });

  // URL pública direta — não precisa de Signed URL nem de permissão especial
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  return publicUrl;
};

exports.handler = async (event) => {
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

  const { db, bucket } = initFirebase();
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
            text: `${prompt}. CRITICAL RULES: DO NOT include any text, letters, words, labels, UI elements, watermarks or logos in the image. The image must look like a real professional photograph taken by a human photographer, not like AI-generated art or digital illustration, unless explicitly specified otherwise in the style description.`
          }]
        },
        config: {
          imageConfig: { aspectRatio: "3:4" },
        },
      });

      let imageUrl = null;

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64DataUrl = `data:image/png;base64,${part.inlineData.data}`;
            imageUrl = await uploadImageToStorage(bucket, base64DataUrl, jobId);
            break;
          }
        }
      }

      await saveJobResult(db, jobId, {
        status: "done",
        imageData: imageUrl,
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
