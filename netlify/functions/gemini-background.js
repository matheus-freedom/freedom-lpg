// ============================================================
// FREEDOMLPG — Background Function: gemini-background
// VERSÃO COM LOGS DE DIAGNÓSTICO
// ============================================================

const { GoogleGenAI } = require("@google/genai");
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

  const { jobId, action, payload } = body;

  if (!jobId || !action || !payload) {
    console.error("Parâmetros faltando:", { jobId, action, hasPayload: !!payload });
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
