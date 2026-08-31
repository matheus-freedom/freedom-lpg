// ============================================================
// FREEDOMLPG — Netlify Function: /netlify/functions/gemini
// ------------------------------------------------------------
// Apenas ações RÁPIDAS ficam aqui (translate, generateAudio).
// Ações pesadas (generateContent, generateImage) são
// despachadas para gemini-background via fetch interno,
// e o resultado é lido pelo frontend via polling no Firebase.
// ============================================================

const { GoogleGenAI, Modality, Type } = require("@google/genai");

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

      // Determina a URL base do site.
      // Em produção o Netlify preenche process.env.URL automaticamente.
      // DEPLOY_URL é um fallback que o Netlify também fornece.
      // Por último, localhost para desenvolvimento.
      const siteUrl =
        process.env.URL ||
        process.env.DEPLOY_URL ||
        "http://localhost:8888";

      const backgroundUrl = `${siteUrl}/.netlify/functions/gemini-background`;
      console.log("[gemini] Disparando background em:", backgroundUrl, "jobId:", jobId);

      // CRÍTICO: precisamos AGUARDAR (await) o fetch completar antes de
      // retornar. Em funções serverless, o ambiente é congelado assim que
      // a função retorna — um fetch não-aguardado seria interrompido antes
      // de enviar o pedido, e a background nunca seria invocada.
      //
      // A background responde 202 quase instantaneamente (ela apenas
      // confirma o recebimento e segue processando por conta própria),
      // então este await custa ~1 segundo, não o tempo do trabalho pesado.
      try {
        const dispatchResponse = await fetch(backgroundUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, action, payload }),
        });
        console.log("[gemini] Background respondeu status:", dispatchResponse.status);
      } catch (err) {
        // Se o disparo falhar, avisamos o frontend em vez de devolver um
        // jobId que nunca produziria resultado (evita o polling eterno).
        console.error("[gemini] Erro ao disparar background function:", err);
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: "Não foi possível iniciar a geração. Tente novamente." }),
        };
      }

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

    // ---------------------------------------------------------
    // ACAO RAPIDA: Traduzir lista de vocabulario (Student Worksheet)
    // Recebe ate 20 palavras e devolve, para cada uma, os significados
    // mais comuns em Portugues Brasileiro (mais de um quando houver).
    // Uma unica chamada para a lista inteira - mais rapido e mais
    // barato do que traduzir palavra por palavra.
    // ---------------------------------------------------------
    if (action === "translateVocab") {
      const { words } = payload;

      if (!Array.isArray(words) || words.length === 0 || words.length > 20) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Lista de palavras invalida." }) };
      }

      const vocabSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING, description: "The English word, exactly as received." },
            translations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "1 to 3 common Brazilian Portuguese meanings, most frequent first.",
            },
          },
          required: ["word", "translations"],
        },
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{
          parts: [{
            text: `Translate each of these English words to Brazilian Portuguese for an English student's vocabulary list.
For each word, give its most common meanings - include 2 or 3 meanings when the word genuinely has more than one frequent sense (e.g. "play" = jogar, brincar, tocar). Give only 1 when the word has a single dominant meaning. Keep translations short (single words or very short expressions), no explanations.
Words: ${words.join(", ")}`
          }],
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: vocabSchema,
        },
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ vocab: JSON.parse(response.text || "[]") }),
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
