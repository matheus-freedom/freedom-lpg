// ============================================================
// FREEDOMLPG — Netlify Function: /netlify/functions/gemini
// ------------------------------------------------------------
// Apenas ações RÁPIDAS ficam aqui (translate, generateAudio).
// Ações pesadas (generateContent, generateImage) são
// despachadas para gemini-background via fetch interno,
// e o resultado é lido pelo frontend via polling no Firebase.
// ============================================================

const { GoogleGenAI, Modality } = require("@google/genai");

const ALLOWED_ORIGINS = [
  "https://freedomlpg.netlify.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8888",
];

const buildHeaders = (origin) => {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
};

// Gera um ID único para cada job
const generateJobId = () =>
  `job_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

exports.handler = async (event) => {
  const origin = event.headers.origin || "";
  const headers = buildHeaders(origin);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!process.env.GEMINI_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Configuração incompleta." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "JSON inválido." }) };
  }

  const { action, payload } = body;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {

    // ---------------------------------------------------------
    // AÇÕES PESADAS → despachadas para background function
    // Retorna jobId imediatamente. O frontend faz polling
    // no Firebase para buscar o resultado quando ficar pronto.
    // ---------------------------------------------------------
    if (action === "generateContent" || action === "generateImage") {
      const jobId = generateJobId();

      // Determina a URL base do Netlify (funciona em prod e dev local)
      const siteUrl = process.env.URL || "http://localhost:8888";

      // Dispara a background function sem esperar resposta
      // (o fetch resolve com 202 Accepted imediatamente)
      fetch(`${siteUrl}/.netlify/functions/gemini-background`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action, payload }),
      }).catch((err) => {
        console.error("Erro ao disparar background function:", err);
      });

      // Retorna o jobId para o frontend iniciar o polling
      return {
        statusCode: 202,
        headers,
        body: JSON.stringify({ jobId }),
      };
    }

    // ---------------------------------------------------------
    // AÇÃO RÁPIDA: Gerar áudio TTS
    // ---------------------------------------------------------
    if (action === "generateAudio") {
      const { text, voiceName, accentInstruction } = payload;

      const systemInstruction = accentInstruction
        ? `You are a text-to-speech narrator. Read the text naturally ${accentInstruction}. Maintain this accent consistently throughout the entire reading.`
        : undefined;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          ...(systemInstruction && { systemInstruction }),
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ audioData: base64Audio || "" }),
      };
    }

    // ---------------------------------------------------------
    // AÇÃO RÁPIDA: Traduzir palavra (ClassroomView)
    // ---------------------------------------------------------
    if (action === "translate") {
      const { word } = payload;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ parts: [{ text: `Translate the English word "${word}" to Portuguese. Provide ONLY the Portuguese word, nothing else.` }] }],
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ text: response.text?.trim() || "" }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Ação desconhecida: ${action}` }),
    };

  } catch (error) {
    console.error("Erro na função Gemini LPG:", error);
    const msg = error?.message || "";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: "Limite de requisições atingido." }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro ao processar requisição." }) };
  }
};
