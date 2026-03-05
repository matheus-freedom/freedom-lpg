import { GoogleGenAI, Type } from "@google/genai";
import { LessonPlan, CEFRLevel, StudentCount, Duration } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Função criada para substituir o crypto.randomUUID() e funcionar em qualquer dispositivo/rede
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
};

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

// Generates an image using the gemini-2.5-flash-image model.
export const generateLessonImage = async (prompt: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A high-quality, professional, cinematic, and clear photographic illustration. Style: clean, inspiring, and modern. Topic: ${prompt}. DO NOT show any text, letters, UI elements, or logos. Ensure the image is a perfect visual aid for a language student to understand the context of the lesson.` }]
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (e) {
    console.error("Failed to generate image", e);
  }
  return undefined;
};

// Generates a structured lesson plan using the stable model
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
}): Promise<LessonPlan> => {
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

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: lessonPlanSchema,
    },
  });

  const rawData = JSON.parse(response.text);
  return {
    ...rawData,
    id: generateId(), // Trocado aqui
    createdAt: Date.now(),
    level: params.level,
    studentCount: params.studentCount,
    duration: params.duration,
    grammarTopic: params.grammarTopic,
    vocabularyFocus: params.vocabularyFocus
  };
};

// Generates a quick version of a lesson plan using the stable model
export const generateQuickLessonPlan = async (params: {
  level: CEFRLevel;
  studentCount: StudentCount;
  grammarTopic: string;
  vocabularyFocus: string;
  extraInfo?: string;
}): Promise<LessonPlan> => {
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

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: lessonPlanSchema,
    },
  });

  const rawData = JSON.parse(response.text);
  return {
    ...rawData,
    id: generateId(), // Trocado aqui também
    createdAt: Date.now(),
    level: params.level,
    studentCount: params.studentCount,
    duration: '1h',
    grammarTopic: params.grammarTopic,
    vocabularyFocus: params.vocabularyFocus,
    isQuickLesson: true
  };
};

// Generates a comprehensive English exam based on CEFR level
export const generateExam = async (level: CEFRLevel): Promise<string> => {
  const prompt = `Create a comprehensive English exam for CEFR level ${level}.
    The exam should include:
    1. Reading Comprehension (a text followed by 5 multiple-choice questions).
    2. Grammar & Vocabulary (10 multiple-choice questions).
    3. Writing Task (a descriptive prompt for an email or essay).
    4. Speaking Task (discussion prompts for the teacher).
    
    Format the response in clean Markdown.
    - Student tasks and questions MUST be in ENGLISH.
    - Instructions and teacher keys MUST be in PORTUGUÊS BRASILEIRO.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
  });

  return response.text || "";
};

// Generates a dynamic playground activity for classroom engagement
export const generatePlaygroundActivity = async (level: CEFRLevel, typeId: string): Promise<any> => {
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

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Create a dynamic and fun English classroom activity for level ${level}.
    Activity Type: ${typeId}.
    
    Language Rules:
    - title, targetSkills, studentMaterial, backupQuestions MUST be in ENGLISH.
    - setupInstructions and activitySteps MUST be in PORTUGUÊS BRASILEIRO.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: playgroundSchema,
    },
  });

  return JSON.parse(response.text);
};