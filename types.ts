
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type StudentCount = 1 | 2 | 3 | 4 | 5;
export type Duration = '30 min' | '1h' | '2h' | '3h';

export interface User {
  id?: string;        // uid do Firebase Auth (preenchido pelo App.tsx)
  name: string;
  email: string;
  username?: string;
  role?: 'admin' | 'teacher';
  photo?: string;
  age?: number;
  gender?: string;
  bio?: string;
  joinedAt?: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Section {
  title: string;
  description: string;
  teacherNotes?: string;
  studentContent?: string;
  isConversation?: boolean;
  durationMinutes?: number;
  backgroundQuestions?: string[];
}

export interface AudioConfig {
  enabled: boolean;
  gender: 'male' | 'female';
  accent: 'american' | 'british';
  voiceName: string;
}

// Entrada da lista de vocabulario do Student Worksheet.
// Uma palavra em ingles pode ter mais de um significado em portugues,
// por isso "translations" e uma lista (ex: "play" = jogar, brincar, tocar).
export interface VocabEntry {
    word: string;
    translations: string[];
}

export interface LessonPlan {
  id: string;
  createdAt: number;
  authorName: string;
  title: string;
  level: CEFRLevel;
  studentCount: StudentCount;
  duration: Duration;
  grammarTopic: string;
  vocabularyFocus: string;
  isQuickLesson?: boolean;
  illustrationImage?: string; 
  visualPrompt?: string;
  quiz?: QuizQuestion[];
  sections: Section[];
  icebreaker?: string;
  closingActivity?: string;
  homework?: string;
  audioConfig?: AudioConfig;
    // Cache das traducoes do vocabulario para o Student Worksheet.
    // Geramos uma vez (custa uma chamada de IA) e salvamos aqui no plano -
    // os proximos downloads do worksheet saem instantaneos e de graca.
    vocabTranslations?: VocabEntry[];
}

export interface UserStats {
  totalLessons: number;
  levelDistribution: Record<CEFRLevel, number>;
}

// ── Inspirações semanais ──────────────────────────────────────
// Geradas no servidor (gemini-background, action generateInspirations)
// todo domingo às 18h e lidas pelo app em inspirations/current.

export type InspirationCategoryId =
  | 'business'
  | 'science-tech'
  | 'health'
  | 'politics'
  | 'culture-history'
  | 'travel'
  | 'trending'
  | 'entertainment'
  | 'kids'
  | 'teens';

export interface InspirationProposal {
  id: string;                       // ex: "business-3"
  title: string;                    // em inglês
  hook: string;                     // 2 frases em inglês
  level: CEFRLevel;                 // nível sugerido
  vocabulary: string[];             // 6-8 palavras em inglês
  conversationQuestions: string[];  // 3 perguntas em inglês
  grammarIdea: string;              // ponto gramatical sugerido (inglês)
  whyNow: string;                   // por que agora (português)
  isTrending: boolean;              // ligado a um fato da semana?
}

export interface InspirationCategory {
  id: InspirationCategoryId;
  label: string;
  emoji: string;
  proposals: InspirationProposal[];
}

export interface InspirationHeadline {
  topic: string;  // manchete curta em inglês
  why: string;    // por que está em alta (português)
}

export interface WeeklyInspirations {
  weekId: string;        // "AAAA-MM-DD" (data da geração, fuso de Brasília)
  generatedAt: number;   // timestamp ms
  validUntil: number;    // próximo domingo 18h (ms)
  model: string;
  groundingUsed: boolean; // true = pesquisa no Google funcionou nesta semana
  headlines: InspirationHeadline[];
  categories: InspirationCategory[];
}

// O que a aba Inspirações envia ao Quick Lesson via navigate(..., { state })
// para pré-preencher o formulário.
export interface InspirationPrefill {
  title: string;
  level: CEFRLevel;
  vocabularyFocus: string;
  extraInfo: string;
  grammarIdea?: string;
}
