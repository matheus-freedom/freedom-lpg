import { GoogleGenAI, Type } from "@google/genai";
import { LessonPlan, CEFRLevel, StudentCount, Duration } from "../types";
import { db } from "./firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";

// ── URL da Netlify Function ───────────────────────────────────
const FUNCTION_URL = import.meta.env.DEV
  ? "http://localhost:8888/.netlify/functions/gemini"
  : "/.netlify/functions/gemini";

// ── Gerador de ID compatível com todos os browsers ───────────
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 15);

// ── Chama a função Netlify para ações RÁPIDAS ─────────────────
// (translate, generateAudio)
const callGeminiDirect = async (action: string, payload: Record<string, any>) => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json();
};

// ── Chama a função Netlify para ações PESADAS ─────────────────
// (generateContent, generateImage)
// Fluxo:
//   1. Envia a requisição → recebe jobId (202 Accepted) em ~1 segundo
//   2. Fica em polling no Firestore a cada 3s
//   3. Quando o resultado aparecer, retorna e limpa o documento
const callGeminiWithPolling = async (
  action: string,
  payload: Record<string, any>,
  onProgress?: (message: string) => void,
  timeoutMs = 300_000 // 5 minutos
): Promise<any> => {
  // 1. Dispara a background function e recebe o jobId
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const { jobId } = await response.json();
  if (!jobId) throw new Error("Nenhum jobId recebido do servidor.");

  onProgress?.("Fred está trabalhando...");

  // 2. Polling no Firestore
  const startedAt = Date.now();
  const pollInterval = 3_000; // verifica a cada 3 segundos

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("A geração demorou demais. Tente novamente."));
        return;
      }

      try {
        const jobRef = doc(db, "lpg_jobs", jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
          // Resultado ainda não chegou — tenta de novo em 3s
          setTimeout(poll, pollInterval);
          return;
        }

        const jobData = jobSnap.data();

        // Limpa o documento do Firestore (não precisamos mais dele)
        deleteDoc(jobRef).catch(() => {});

        if (jobData.status === "error") {
          reject(new Error(jobData.error || "Erro na geração."));
          return;
        }

        resolve(jobData);
      } catch (error) {
        // Erro de conexão no polling — tenta de novo
        console.warn("Erro no polling, tentando novamente...", error);
        setTimeout(poll, pollInterval);
      }
    };

    // Primeira verificação após 4 segundos
    // (dá tempo para a background function iniciar)
    setTimeout(poll, 4_000);
  });
};

// ─────────────────────────────────────────────────────────────
// Schema do plano de aula
// ─────────────────────────────────────────────────────────────
const lessonPlanSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    visualPrompt: { type: Type.STRING, description: "A highly descriptive prompt for an image generator that visually represents the core scene or topic of the reading text. Describe colors, objects, and atmosphere. Can include people if relevant." },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          teacherNotes: { type: Type.STRING, description: "Instruções para o professor em Português Brasileiro." },
          studentContent: { type: Type.STRING, description: "Content for the student. MUST BE IN ENGLISH." },
          isConversation: { type: Type.BOOLEAN },
          durationMinutes: { type: Type.NUMBER },
          backgroundQuestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 follow-up questions related to the main studentContent question. MUST BE IN ENGLISH." }
        },
        required: ["title", "description", "teacherNotes", "studentContent"]
      }
    },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "Quiz question in ENGLISH." },
          options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Options in ENGLISH." },
          correctIndex: { type: Type.NUMBER },
          explanation: { type: Type.STRING, description: "Explicação em Português Brasileiro sobre a resposta correta." }
        },
        required: ["question", "options", "correctIndex", "explanation"]
      }
    },
    icebreaker: { type: Type.STRING, description: "Activity description in ENGLISH." },
    closingActivity: { type: Type.STRING, description: "Activity description in ENGLISH." },
    homework: { type: Type.STRING, description: "Homework description in ENGLISH." },
  },
  required: ["title", "sections", "homework", "visualPrompt"]
};

// ─────────────────────────────────────────────────────────────
// Gera imagem via background function
// ─────────────────────────────────────────────────────────────
export const generateLessonImage = async (
  prompt: string,
  onProgress?: (message: string) => void
): Promise<string | undefined> => {
  try {
    onProgress?.("Criando ilustração personalizada...");
    const result = await callGeminiWithPolling("generateImage", { prompt }, onProgress);
    return result.imageData || undefined;
  } catch (e) {
    console.error("Failed to generate image", e);
    return undefined;
  }
};

// ─────────────────────────────────────────────────────────────
// Gera plano de aula completo via background function
// ─────────────────────────────────────────────────────────────
export const generateLessonPlan = async (params: {
  level: CEFRLevel;
  studentCount: StudentCount;
  duration: Duration;
  grammarTopic: string;
  vocabularyFocus: string;
  includeExplanations: boolean;
  generateImage: boolean;
  generateText: boolean;
  generateAudio: boolean;
  audioVoice: string;
  audioAccent: string;
  includeConversationQuestions: boolean;
  icebreaker: boolean;
  closing: boolean;
  homework: boolean;
}, onProgress?: (message: string) => void): Promise<LessonPlan> => {
  const prompt = `Crie um plano de aula FASCINANTE de Inglês (Level: ${params.level}).
    TEMA OBRIGATÓRIO: Use fatos reais de Ciência, História ou Curiosidades relacionados a ${params.vocabularyFocus}.
    FOCO GRAMATICAL (MANDATÓRIO): Você DEVE usar a gramática "${params.grammarTopic}" extensivamente no conteúdo.
    
    REGRAS DE IDIOMA (CRÍTICO):
    - "title", "studentContent", "visualPrompt" e "quiz questions/options" DEVEM estar em INGLÊS.
    - "teacherNotes" e "explanation" DEVEM estar em PORTUGUÊS BRASILEIRO.
    
    REGRAS DE FORMATAÇÃO:
    - NO studentContent, JAMAIS use símbolos # ou ##.
    - Use parágrafos fluídos com quebras de linha duplas (\\n\\n).
    - Use APENAS ** para destacar vocabulário essencial.`;

  onProgress?.("Analisando objetivos e gerando plano...");

  const result = await callGeminiWithPolling(
    "generateContent",
    {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: lessonPlanSchema,
      },
    },
    onProgress
  );

  const rawData = JSON.parse(result.text);
  return {
    ...rawData,
    id: generateId(),
    createdAt: Date.now(),
    level: params.level,
    studentCount: params.studentCount,
    duration: params.duration,
    grammarTopic: params.grammarTopic,
    vocabularyFocus: params.vocabularyFocus
  };
};

// ─────────────────────────────────────────────────────────────
// Gera Quick Lesson via background function
// ─────────────────────────────────────────────────────────────
export const generateQuickLessonPlan = async (params: {
  level: CEFRLevel;
  studentCount: StudentCount;
  grammarTopic: string;
  vocabularyFocus: string;
  extraInfo?: string;
}, onProgress?: (message: string) => void): Promise<LessonPlan> => {
  const isC1 = params.level === 'C1';
  const isB = params.level === 'B1' || params.level === 'B2';
  const paragraphsCount = isC1 ? 3 : (isB ? 2 : 1);

  const prompt = `Create a "Quick Power Lesson" level ${params.level}.
    CORE TOPIC (Vocabulary): "${params.vocabularyFocus.toUpperCase()}".
    CORE GRAMMAR (Mandatory): "${params.grammarTopic.toUpperCase()}".
    
    STRICT CONTENT RULES:
    1. Every single section of this lesson MUST naturally incorporate the grammar "${params.grammarTopic}".
    2. The reading text MUST use the grammar topic at least 3 times.
    3. Every conversation question MUST be structured to encourage the student to use "${params.grammarTopic}".
    
    STRICT STRUCTURE RULES:
    1. The "sections" array MUST have EXACTLY 11 items.
    2. sections[0]: The main READING text (${paragraphsCount} paragraph(s)) about ${params.vocabularyFocus}.
    3. sections[1] to [10]: Ten distinct CONVERSATION questions that use or target ${params.grammarTopic}.
    4. Each conversation section MUST have 3 "backgroundQuestions" for the teacher in English.
    5. The "quiz" array MUST have EXACTLY 5 items.
    
    STRICT LANGUAGE RULES:
    - title, studentContent, backgroundQuestions, quiz, visualPrompt: ALL IN ENGLISH.
    - teacherNotes, explanation: BRAZILIAN PORTUGUESE.
    
    ${params.extraInfo ? `ADDITIONAL CONTEXT/TONE: ${params.extraInfo}` : ''}
    
    Separate reading paragraphs with \\n\\n.
    At the very end of sections[0].studentContent, add the delimiter "||VOCAB||" followed by 10 vocab words.`;

  onProgress?.("Analisando objetivos e gerando texto...");

  const result = await callGeminiWithPolling(
    "generateContent",
    {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: lessonPlanSchema,
      },
    },
    onProgress
  );

  const rawData = JSON.parse(result.text);
  return {
    ...rawData,
    id: generateId(),
    createdAt: Date.now(),
    level: params.level,
    studentCount: params.studentCount,
    duration: '1h',
    grammarTopic: params.grammarTopic,
    vocabularyFocus: params.vocabularyFocus,
    isQuickLesson: true
  };
};

// ─────────────────────────────────────────────────────────────
// Gera prova completa via background function
// ─────────────────────────────────────────────────────────────
export const generateExam = async (
  level: CEFRLevel,
  onProgress?: (message: string) => void
): Promise<string> => {
  const prompt = `Create a comprehensive English exam for CEFR level ${level}.
    The exam should include:
    1. Reading Comprehension (a text followed by 5 multiple-choice questions).
    2. Grammar & Vocabulary (10 multiple-choice questions).
    3. Writing Task (a descriptive prompt for an email or essay).
    4. Speaking Task (discussion prompts for the teacher).
    
    Format the response in clean Markdown.
    - Student tasks and questions MUST be in ENGLISH.
    - Instructions and teacher keys MUST be in PORTUGUÊS BRASILEIRO.`;

  onProgress?.("Gerando prova...");

  const result = await callGeminiWithPolling(
    "generateContent",
    {
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {},
    },
    onProgress
  );

  return result.text || "";
};

// ─────────────────────────────────────────────────────────────
// Gera atividade de playground via background function
// ─────────────────────────────────────────────────────────────
export const generatePlaygroundActivity = async (
  level: CEFRLevel,
  typeId: string,
  onProgress?: (message: string) => void
): Promise<any> => {
  const playgroundSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      targetSkills: { type: Type.STRING },
      setupInstructions: { type: Type.STRING, description: "Instruções de preparação para o professor em PORTUGUÊS BRASILEIRO." },
      activitySteps: { type: Type.STRING, description: "Passo a passo da atividade em PORTUGUÊS BRASILEIRO." },
      studentMaterial: { type: Type.STRING, description: "Content for the student to see/read in ENGLISH." },
      backupQuestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Support questions for the teacher in ENGLISH." }
    },
    required: ["title", "targetSkills", "setupInstructions", "activitySteps", "studentMaterial", "backupQuestions"]
  };

  onProgress?.("Preparando atividade...");

  const result = await callGeminiWithPolling(
    "generateContent",
    {
      contents: `Create a dynamic and fun English classroom activity for level ${level}. Activity Type: ${typeId}.
      Language Rules:
      - title, targetSkills, studentMaterial, backupQuestions MUST be in ENGLISH.
      - setupInstructions and activitySteps MUST be in PORTUGUÊS BRASILEIRO.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: playgroundSchema,
      },
    },
    onProgress
  );

  return JSON.parse(result.text);
};

// ─────────────────────────────────────────────────────────────
// Gera áudio TTS — SÍNCRONO (função rápida, sem polling)
// ─────────────────────────────────────────────────────────────
export const generateAudioFromText = async (
  text: string,
  voiceName: string,
  accentInstruction?: string
): Promise<string> => {
  try {
    const result = await callGeminiDirect("generateAudio", {
      text,
      voiceName,
      accentInstruction,
    });
    return result.audioData || "";
  } catch (e) {
    console.warn("TTS generation failed", e);
    return "";
  }
};

// ─────────────────────────────────────────────────────────────
// Traduz palavra — SÍNCRONO (função rápida, sem polling)
// ─────────────────────────────────────────────────────────────
export const translateWordToPortuguese = async (word: string): Promise<string> => {
  try {
    const result = await callGeminiDirect("translate", { word });
    return result.text || "";
  } catch {
    return "";
  }
};
