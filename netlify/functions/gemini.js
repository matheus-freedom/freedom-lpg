// ============================================================
// FREEDOMLPG — Netlify Function: /netlify/functions/gemini
// ------------------------------------------------------------
// Protege a chave Gemini e as credenciais Firebase
// do FreedomLPG (Lesson Plan Generator)
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
    console.error("GEMINI_API_KEY não configurada!");
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
    // AÇÃO: Gerar conteúdo (plano de aula, prova, playground)
    // Modelo fixado no servidor para garantir estabilidade.
    // gemini-3.5-flash é usado para geração de aulas (rápido e qualidade).
    // gemini-2.5-pro é mantido apenas para provas (generateExam).
    // ---------------------------------------------------------
    if (action === "generateContent") {
      const { contents, config } = payload;

      // Se o cliente pediu gemini-2.5-pro (usado na geração de provas),
      // respeitamos. Para tudo mais, usamos gemini-3.5-flash.
      const model = payload.model === "gemini-2.5-pro"
        ? "gemini-2.5-pro"
        : "gemini-3.5-flash";

      const response = await ai.models.generateContent({ model, contents, config });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ text: response.text }),
      };
    }

    // ---------------------------------------------------------
    // AÇÃO: Gerar imagem da aula
    // ---------------------------------------------------------
    if (action === "generateImage") {
      const { prompt } = payload;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-05-20",
        contents: {
          parts: [{
            text: `A high-quality, professional, cinematic illustration. Style: clean, inspiring, modern. Topic: ${prompt}. DO NOT show any text, letters, UI elements, or logos.`
          }]
        },
        config: { responseModalities: ["IMAGE", "TEXT"] },
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
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ imageData }),
      };
    }

    // ---------------------------------------------------------
    // AÇÃO: Gerar áudio TTS para a aula
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
    // AÇÃO: Traduzir palavra (ClassroomView)
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
