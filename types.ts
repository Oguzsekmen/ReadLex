// Domain Entities

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type BookStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type UserRole = 'USER' | 'ADMIN';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED';
export type PlanType = string; // Changed from union to string to support dynamic admin plans

export interface User {
  id: string;
  email: string;
  name: string;
  password?: string; 
  avatarUrl?: string; // New: For profile pictures
  languagePreference: 'TR' | 'EN';
  role: UserRole;
  streak: number;
  xp: number;
  
  // Adaptive Learning Goals
  dailyGoal: number; // Dynamic goal (starts at 25)
  lastVisitDate: number; // Timestamp to calculate day transitions
  
  // Subscription
  subscriptionStatus: SubscriptionStatus;
  plan: PlanType;
  trialEndsAt: number; // Timestamp
  subscriptionEndsAt?: number; // Timestamp
}

export interface Book {
  id: string;
  title: string;
  author: string;
  level: CEFRLevel;
  coverUrl: string;
  content: string; 
  excerpt: string;
  totalWords: number;
  requiredPlan: PlanType[]; // Array of PlanType strings
  archived: boolean; // Soft Delete
}

export interface UserBookProgress {
  bookId: string;
  status: BookStatus;
  lastPosition: number; // Percentage or paragraph index
  lastReadAt: Date;
}

export interface VocabularyWord {
  id: string;
  word: string;
  translation: string;
  definition: string;
  exampleSentence: string;
  type: string; // noun, verb, etc.
  level: CEFRLevel;
  sourceBookId: string;
  nextReviewDate: Date;
  strength: number; // 0-5 for SRS
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
  options?: string[]; // For Multiple Choice
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
  }[];
}