
// Domain Entities

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type BookStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type UserRole = 'USER' | 'ADMIN';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED';
export type PlanType = string; 

export interface UserProfile {
  id: string;
  email: string;
  name: string;
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
  // Derived from Firebase Auth at runtime; never persisted in the user profile.
  emailVerified?: boolean;
}

// Existing components retain User during the transition; it is the application
// view of the Firestore users/{uid} profile rather than an Auth credential.
export interface User extends UserProfile {}

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
  // Present when a reader/admin explicitly loads chapter content. Library
  // listings use metadata only and retain this optional for legacy documents.
  chapters?: Chapter[];
  excerpt: string;
  totalWords: number;
  requiredPlan: PlanType[]; 
  archived: boolean; 
  chapterCount?: number;
  createdAt?: Date | number;
  updatedAt?: Date | number;
  source?: {
    type: 'MANUAL_TEXT' | 'OCR_IMAGE' | 'OCR_PDF';
    importId?: string;
  };
  languageProcessingStatus?: 'NOT_STARTED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  languageProcessingVersion?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  uniqueWordsTotal?: number;
  dictionaryHits?: number;
  dictionaryMisses?: number;
  wordsTranslated?: number;
  sentencesTotal?: number;
  sentencesTranslated?: number;
  chaptersProcessed?: number;
}

export type BookImportStatus =
  | 'DRAFT'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'REVIEW_REQUIRED'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELED';

export type BookImportSourceType = 'TEXT' | 'IMAGE' | 'PDF';

export interface DetectedChapter {
  tempId: string;
  title: string;
  order: number;
  content: string;
  sourceStart?: number;
  sourceEnd?: number;
}

export interface BookImportSourceFile {
  id: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  size: number;
  order: number;
  uploadedAt?: Date | number;
}

export interface BookImportJob {
  id: string;
  createdBy: string;
  status: BookImportStatus;
  sourceType: BookImportSourceType;
  originalFileName?: string;
  title?: string;
  author?: string;
  level?: CEFRLevel;
  requiredPlan?: PlanType[];
  coverUrl?: string;
  rawText?: string;
  normalizedText?: string;
  detectedChapters?: DetectedChapter[];
  errorCode?: string;
  errorMessage?: string;
  createdAt?: Date | number;
  updatedAt?: Date | number;
  processingStartedAt?: Date | number;
  processingCompletedAt?: Date | number;
  publishedBookId?: string;
  normalizationVersion?: string;
  chapterDetectionVersion?: string;
  sourceFiles?: BookImportSourceFile[];
  ocrStatus?: 'NOT_STARTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  ocrProvider?: string;
  ocrVersion?: string;
  ocrStartedAt?: Date | number;
  ocrCompletedAt?: Date | number;
  pagesTotal?: number;
  pagesProcessed?: number;
  progressPercent?: number;
  draftChapterCount?: number;
}

export interface UserBookProgress {
  bookId: string;
  status: BookStatus;
  currentChapterIndex: number; // Track which chapter user is on
  lastWordIndex?: number; // New: Track specific word position in the chapter
  lastReadAt: Date;
  currentChapterId?: string;
  progressPercent?: number;
  chapterContentHash?: string;
  completedAt?: Date;
}

export interface VocabularyEntry {
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
  normalizedWord?: string;
  sourceChapterId?: string;
  createdAt?: Date | number;
  updatedAt?: Date | number;
  nextReviewAt?: Date | number;
  lastReviewedAt?: Date | number;
  correctCount?: number;
  wrongCount?: number;
  repetitions?: number;
  intervalDays?: number;
  easeFactor?: number;
}

export type ReviewGrade = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

export type VocabularyWord = VocabularyEntry;

export interface Plan {
  id: PlanType;
  name: string;
  price: number;
  durationDays: number; 
  features: string[];
}

export type PlanConfig = Plan;

export interface ReviewEvent {
  id: string;
  vocabularyId: string;
  result: 'CORRECT' | 'WRONG' | 'SKIPPED';
  questionType: QuizQuestion['type'];
  previousStrength: number;
  newStrength?: number;
  reviewedAt: Date | number;
}

export type SubscriptionState = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

export interface Subscription {
  id: string;
  userId: string;
  planId: PlanType;
  status: SubscriptionState;
  provider: string;
  trialStartedAt?: Date | number;
  trialEndsAt?: Date | number;
  currentPeriodStart?: Date | number;
  currentPeriodEnd?: Date | number;
  cancelAtPeriodEnd?: boolean;
  providerSubscriptionId?: string;
  createdAt?: Date | number;
  updatedAt?: Date | number;
}

export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  provider: string;
  status: string;
  amount?: number;
  currency?: string;
  providerPaymentId?: string;
  createdAt?: Date | number;
  updatedAt?: Date | number;
}

export interface DictionaryEntry {
  id: string;
  word: string;
  normalizedWord: string;
  language: string;
  translation?: string;
  definition?: string;
  createdAt?: Date | number;
  updatedAt?: Date | number;
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
