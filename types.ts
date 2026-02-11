
// Domain Entities

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type BookStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type UserRole = 'USER' | 'ADMIN';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED';
export type PlanType = string; 

export interface User {
  id: string;
  email: string;
  name: string;
  password?: string; 
  avatarUrl?: string; 
  languagePreference: 'TR' | 'EN';
  role: UserRole;
  streak: number;
  xp: number;
  
  // Adaptive Learning Goals
  dailyGoal: number; 
  lastVisitDate: number; 
  
  // Subscription
  subscriptionStatus: SubscriptionStatus;
  plan: PlanType;
  trialEndsAt: number; 
  subscriptionEndsAt?: number; 
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  level: CEFRLevel;
  coverUrl: string;
  chapters: Chapter[]; // Changed from content: string
  excerpt: string;
  totalWords: number;
  requiredPlan: PlanType[]; 
  archived: boolean; 
}

export interface UserBookProgress {
  bookId: string;
  status: BookStatus;
  currentChapterIndex: number; // New: Track which chapter user is on
  lastReadAt: Date;
}

export interface VocabularyWord {
  id: string;
  word: string;
  translation: string;
  definition: string;
  exampleSentence: string;
  type: string; 
  level: CEFRLevel;
  sourceBookId: string;
  nextReviewDate: Date;
  strength: number; 
}

export interface PlanConfig {
  id: PlanType;
  name: string;
  price: number;
  durationDays: number; 
  features: string[];
}

export interface QuizQuestion {
  id: string;
  type: 'MC_EN_TR' | 'MC_TR_EN' | 'WRITE' | 'LISTEN';
  question: string;
  correctAnswer: string;
  options?: string[]; 
  wordReference: VocabularyWord;
}

export interface QuizResult {
  score: number;
  total: number;
  wrongWordIds: string[];
}

// Service Responses

export interface DefinitionResponse {
  word: string;
  phonetic?: string;
  meanings: {
    partOfSpeech: string;
    translation: string;
    definition: string;
    example: string;
    translatedExample?: string;
  }[];
}
