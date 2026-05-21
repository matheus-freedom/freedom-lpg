// ============================================================
// FreedomLPG — services/geminiService.ts  (VERSÃO SEGURA)
// ============================================================

import { LessonPlan, CEFRLevel, StudentCount, Duration } from "../types";

const FUNCTION_URL = import.meta.env.DEV
  ? "http://localhost:8888/.netlify/functions/gemini"
  : "/.netlify/functions/gemini";

// ── Chamada segura ao servidor ───────────────────────────────
async function callGemini(action: string, payload: Record<string, any>): Promise<any> {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.error || `Erro HTTP ${response.status}`);
  }
  return response.json();
}

// ── Gerador de IDs (substitui crypto.randomUUID para compatibilidade) ──
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 15);

// ── Schemas ───────────────────────────────────────────────────
const lessonPlanSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    visualPrompt: { type: "STRING" },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          teacherNotes: { type: "STRING" },
          studentContent: { type: "STRING" },
          isConversation: { type: "BOOLEAN" },
          durationMinutes: { type: "NUMBER" },
          backgroundQuestions: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["title", "description", "teacherNotes", "studentContent"],
      },
    },
    quiz: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "NUMBER" },
          explanation: { type: "STRING" },
        },
        required: ["question", "options", "correctIndex", "explanation"],
      },
    },
    icebreaker: { type: "STRING" },
    closingActivity: { type: "STRING" },
    homework: { type: "STRING" },
  },
  required: ["title", "sections", "homework", "visualPrompt"],
};

// ════════════════════════════════════════════════════════════
// Gerar imagem da aula
// ════════════════════════════════════════════════════════════
export const generateLessonImage = async (prompt: string): Promise<string | undefined> => {
  try {
    const result = await callGemini("generateImage", { prompt });
    return result.imageData || undefined;
  } catch (e) {
    console.error("Failed to generate image", e);
    return undefined;
  }
};

// ════════════════════════════════════════════════════════════
// Gerar plano de aula completo
// ════════════════════════════════════════════════════════════
export const generateLessonPlan = async (params: {
  level: CEFRLevel; studentCount: StudentCount; duration: Duration;
  grammarTopic: string; vocabularyFocus: string;
  includeExplanations: boolean; generateImage: boolean;
  generateText: boolean; generateAudio: boolean;
  audioVoice: string; audioAccent: string;
  includeConversationQuestions: boolean;
  icebreaker: boolean; closing: boolean; homework: boolean;
}): Promise<LessonPlan> => {
  const prompt = `Crie um plano de aula FASCINANTE de Inglês (Level: ${params.level}).
    TEMA OBRIGATÓRIO: Use fatos reais relacionados a ${params.vocabularyFocus}.
    FOCO GRAMATICAL (MANDATÓRIO): Use a gramática "${params.grammarTopic}" extensivamente.
    REGRAS: title, studentContent, visualPrompt em INGLÊS. teacherNotes, explanation em PORTUGUÊS BRASILEIRO.
    NO studentContent, JAMAIS use símbolos # ou ##.`;

  const result = await callGemini("generateContent", {
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: lessonPlanSchema,
    },
  });

  const rawData = JSON.parse(result.text);
  return {
    ...rawData,
    id: generateId(),
    createdAt: Date.now(),
    level: params.level,
    studentCount: params.studentCount,
    duration: params.duration,
    grammarTopic: params.grammarTopic,
    vocabularyFocus: params.vocabularyFocus,
  };
};

// ════════════════════════════════════════════════════════════
// Gerar quick lesson
// ════════════════════════════════════════════════════════════
export const generateQuickLessonPlan = async (params: {
  level: CEFRLevel; studentCount: StudentCount;
  grammarTopic: string; vocabularyFocus: string; extraInfo?: string;
}): Promise<LessonPlan> => {
  const isC1 = params.level === "C1";
  const isB = params.level === "B1" || params.level === "B2";
  const paragraphsCount = isC1 ? 3 : isB ? 2 : 1;

  const prompt = `Create a "Quick Power Lesson" level ${params.level}.
    CORE TOPIC: "${params.vocabularyFocus.toUpperCase()}".
    CORE GRAMMAR: "${params.grammarTopic.toUpperCase()}".
    STRICT STRUCTURE: sections array MUST have EXACTLY 11 items.
    sections[0]: READING text (${paragraphsCount} paragraph(s)).
    sections[1] to [10]: Ten CONVERSATION questions using ${params.grammarTopic}.
    Each conversation section MUST have 3 "backgroundQuestions".
    quiz array MUST have EXACTLY 5 items.
    LANGUAGE: title, studentContent, backgroundQuestions, quiz, visualPrompt in ENGLISH.
    teacherNotes, explanation in BRAZILIAN PORTUGUESE.
    ${params.extraInfo ? `ADDITIONAL CONTEXT: ${params.extraInfo}` : ""}
    At the end of sections[0].studentContent, add "||VOCAB||" followed by 10 vocab words.`;

  const result = await callGemini("generateContent", {
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: lessonPlanSchema,
    },
  });

  const rawData = JSON.parse(result.text);
  return {
    ...rawData,
    id: generateId(),
    createdAt: Date.now(),
    level: params.level,
    studentCount: params.studentCount,
    duration: "1h",
    grammarTopic: params.grammarTopic,
    vocabularyFocus: params.vocabularyFocus,
    isQuickLesson: true,
  };
};

// ════════════════════════════════════════════════════════════
// Gerar prova
// ════════════════════════════════════════════════════════════
export const generateExam = async (level: CEFRLevel): Promise<string> => {
  const prompt = `Create a comprehensive English exam for CEFR level ${level}.
    Include: Reading Comprehension (5 questions), Grammar (10 questions), Writing Task, Speaking Task.
    Student tasks in ENGLISH. Instructions and keys in PORTUGUÊS BRASILEIRO.
    Format in clean Markdown.`;

  const result = await callGemini("generateContent", {
    model: "gemini-2.5-pro",
    contents: prompt,
    config: {},
  });
  return result.text || "";
};

// ════════════════════════════════════════════════════════════
// Gerar atividade do playground
// ════════════════════════════════════════════════════════════
export const generatePlaygroundActivity = async (
  level: CEFRLevel, typeId: string
): Promise<any> => {
  const playgroundSchema = {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      targetSkills: { type: "STRING" },
      setupInstructions: { type: "STRING" },
      activitySteps: { type: "STRING" },
      studentMaterial: { type: "STRING" },
      backupQuestions: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: ["title", "targetSkills", "setupInstructions", "activitySteps", "studentMaterial", "backupQuestions"],
  };

  const result = await callGemini("generateContent", {
    model: "gemini-2.5-flash",
    contents: `Create a dynamic and fun English classroom activity for level ${level}. Activity Type: ${typeId}. Language: title, targetSkills, studentMaterial, backupQuestions in ENGLISH. setupInstructions and activitySteps in PORTUGUÊS BRASILEIRO.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: playgroundSchema,
    },
  });

  return JSON.parse(result.text);
};

// ════════════════════════════════════════════════════════════
// Traduzir palavra (ClassroomView)
// ════════════════════════════════════════════════════════════
export const translateWord = async (word: string): Promise<string> => {
  try {
    const result = await callGemini("translate", { word });
    return result.text?.trim() || "Error";
  } catch {
    return "Error";
  }
};

// ════════════════════════════════════════════════════════════
// Gerar áudio TTS (ClassroomView)
// accentInstruction: instrução opcional de sotaque em linguagem natural
// Ex: "with a Spanish accent, as if the speaker is a native Spanish speaker"
// ════════════════════════════════════════════════════════════
export const generateAudioFromText = async (
  text: string, voiceName: string, accentInstruction?: string
): Promise<string> => {
  try {
    const result = await callGemini("generateAudio", {
      text,
      voiceName,
      ...(accentInstruction && { accentInstruction }),
    });
    return result.audioData || "";
  } catch (e) {
    console.error("Audio generation failed", e);
    throw e;
  }
};
