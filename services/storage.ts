import { Book, User, VocabularyWord, BookStatus, UserBookProgress, CEFRLevel } from '../types';
import { MOCK_BOOKS } from './data';

// Storage Keys
const USERS_KEY = 'readlex_users';
const BOOKS_KEY = 'readlex_books';
const VOCAB_KEY = 'readlex_vocab_'; 
const PROGRESS_KEY = 'readlex_progress_'; 

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Initial Admin User
const ADMIN_USER: User = {
  id: 'admin-1',
  email: 'admin@readlex.com',
  name: 'Super Admin',
  password: 'admin', 
  role: 'ADMIN',
  languagePreference: 'TR',
  streak: 999,
  xp: 99999,
  subscriptionStatus: 'ACTIVE',
  plan: 'YEARLY',
  trialEndsAt: Date.now() + 365 * 24 * 60 * 60 * 1000
};

const DEFAULT_USER: User = {
  id: 'user-1',
  email: 'demo@readlex.com',
  name: 'New Explorer',
  password: 'demo',
  role: 'USER',
  languagePreference: 'TR',
  streak: 3,
  xp: 150,
  subscriptionStatus: 'TRIAL',
  plan: 'FREE',
  trialEndsAt: Date.now() + THREE_DAYS_MS // 3 Days from now
};

// --- Helper Functions ---

const getFromStorage = <T>(key: string, defaultValue: T): T => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultValue;
};

const saveToStorage = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// --- Initialization ---

export const initStorage = () => {
  const storedBooks = localStorage.getItem(BOOKS_KEY);
  if (!storedBooks) {
    saveToStorage(BOOKS_KEY, MOCK_BOOKS);
  }

  const storedUsers = localStorage.getItem(USERS_KEY);
  if (!storedUsers) {
    saveToStorage(USERS_KEY, [ADMIN_USER, DEFAULT_USER]);
  }
};

// --- User Services ---

export const getUsers = (): User[] => {
  return getFromStorage<User[]>(USERS_KEY, []);
};

export const saveUser = (user: User) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === user.id);
  
  if (index >= 0) {
    users[index] = user; 
  } else {
    users.push(user); 
  }
  
  saveToStorage(USERS_KEY, users);
};

export const deleteUser = (userId: string) => {
  const users = getUsers().filter(u => u.id !== userId);
  saveToStorage(USERS_KEY, users);
};

export const getUserByEmail = (email: string): User | undefined => {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
};

// --- Book Services ---

export const getBooks = (): Book[] => {
  return getFromStorage<Book[]>(BOOKS_KEY, []);
};

export const saveBook = (book: Book) => {
  const books = getBooks();
  const index = books.findIndex(b => b.id === book.id);

  if (index >= 0) {
    books[index] = book;
  } else {
    books.unshift(book);
  }
  
  saveToStorage(BOOKS_KEY, books);
};

export const deleteBook = (bookId: string) => {
  const books = getBooks().filter(b => b.id !== bookId);
  saveToStorage(BOOKS_KEY, books);
};

// --- User Specific Data (Vocab & Progress) ---

export const getUserVocab = (userId: string): VocabularyWord[] => {
  return getFromStorage<VocabularyWord[]>(VOCAB_KEY + userId, []);
};

export const saveUserVocab = (userId: string, words: VocabularyWord[]) => {
  saveToStorage(VOCAB_KEY + userId, words);
};

export const getUserProgress = (userId: string): Record<string, BookStatus> => {
  return getFromStorage<Record<string, BookStatus>>(PROGRESS_KEY + userId, {});
};

export const saveUserProgress = (userId: string, progress: Record<string, BookStatus>) => {
  saveToStorage(PROGRESS_KEY + userId, progress);
};