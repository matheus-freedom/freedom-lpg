const { GoogleGenAI, Modality } = require("@google/genai");

const ALLOWED_ORIGINS = [
  "https://seu-lpg.netlify.app",
  "http://localhost:3000",
  "http://localhost:5173",
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
    if (action === "generateContent") {
      const { model, contents, config } = payload;
      const response = await ai.models.generateContent({ model, contents, config });
      return { statusCode: 200, headers, body: JSON.stringify({ text: response.text }) };
    }

    if (action === "generateImage") {
      const { prompt } = payload;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts: [{ text: `A high-quality, professional, cinematic illustration. Style: clean, inspiring, modern. Topic: ${prompt}. DO NOT show any text, letters, UI elements, or logos.` }] },
        config: { imageConfig: { aspectRatio: "3:4" } },
      });
      let imageData = null;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) { imageData = `data:image/png;base64,${part.inlineData.data}`; break; }
        }
      }
      return { statusCode: 200, headers, body: JSON.stringify({ imageData }) };
    }

    if (action === "generateAudio") {
      const { text, voiceName } = payload;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return { statusCode: 200, headers, body: JSON.stringify({ audioData: base64Audio || "" }) };
    }

    if (action === "translate") {
      const { word } = payload;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: `Translate the English word "${word}" to Portuguese. Provide ONLY the Portuguese word, nothing else.` }] }],
      });
      return { statusCode: 200, headers, body: JSON.stringify({ text: response.text?.trim() || "" }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: `Ação desconhecida: ${action}` }) };

  } catch (error) {
    console.error("Erro na função Gemini LPG:", error);
    const msg = error?.message || "";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: "Limite de requisições atingido." }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro ao processar requisição." }) };
  }
};
