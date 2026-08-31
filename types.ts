
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type StudentCount = 1 | 2 | 3 | 4 | 5;
export type Duration = '30 min' | '1h' | '2h' | '3h';

export interface User {
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
