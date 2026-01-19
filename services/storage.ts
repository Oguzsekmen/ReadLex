import { Book, User, VocabularyWord, BookStatus, UserBookProgress, CEFRLevel } from '../types';
import { MOCK_BOOKS } from './data';

// Storage Keys
const USERS_KEY = 'lexiflow_users';
const BOOKS_KEY = 'lexiflow_books';
const VOCAB_KEY = 'lexiflow_vocab_'; // Prefix for user-specific vocab
const PROGRESS_KEY = 'lexiflow_progress_'; // Prefix for user-specific progress

// Initial Admin User
const ADMIN_USER: User = {
  id: 'admin-1',
  email: 'admin@lexiflow.app',
  name: 'Admin User',
  password: 'admin123', // In real app, hash this
  role: 'ADMIN',
  languagePreference: 'TR',
  streak: 99,
  xp: 9999
};

const DEFAULT_USER: User = {
  id: 'user-1',
  email: 'demo@lexiflow.app',
  name: 'Demo User',
  password: 'password',
  role: 'USER',
  languagePreference: 'TR',
  streak: 5,
  xp: 150
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
  // Initialize Books if empty
  const storedBooks = localStorage.getItem(BOOKS_KEY);
  if (!storedBooks) {
    saveToStorage(BOOKS_KEY, MOCK_BOOKS);
  }

  // Initialize Users if empty
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
    users[index] = user; // Update
  } else {
    users.push(user); // Insert
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
    books.unshift(book); // Add to top
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