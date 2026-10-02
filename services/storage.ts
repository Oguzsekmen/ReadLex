import { Book, User, VocabularyWord, PlanConfig, DefinitionResponse, UserBookProgress } from '../types';
import { MOCK_BOOKS, DEFAULT_PLANS } from './data';
import { db } from './firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { getBookList, getBookWithChapters } from './data/books';
import { deleteVocabularyEntry, getVocabularyEntries, saveVocabularyEntry } from './data/vocabulary';
import { getProgressEntries, saveProgressEntry } from './data/progress';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';

// Collection Names
const USERS_COL = 'users';
const BOOKS_COL = 'books';
const PLANS_COL = 'plans';
const VOCAB_COL = 'vocabulary';
const PROGRESS_COL = 'progress';
const DICT_CACHE_COL = 'dictionary_cache';

// Local Storage Keys
const LOCAL_KEYS = {
  USERS: 'readlex_users',
  BOOKS: 'readlex_books',
  PLANS: 'readlex_plans',
  VOCAB_PREFIX: 'readlex_vocab_',
  PROGRESS_PREFIX: 'readlex_progress_',
  GLOBAL_DICT: 'readlex_global_dict'
};

export let lastFirebaseError: string | null = null;

export const isUsingFirebase = (): boolean => {
  return !!db;
};

const isFirebaseReady = () => !!db;

// A profile document is not authorization data. UI roles are derived from an
// ID-token custom claim in services/auth.ts.
const normalizeBrowserUser = (user: Partial<User>, id?: string): User => ({
  id: id || user.id || '',
  email: user.email || '',
  name: user.name || 'ReadLex User',
  avatarUrl: user.avatarUrl,
  languagePreference: user.languagePreference === 'EN' ? 'EN' : 'TR',
  role: 'USER',
  streak: typeof user.streak === 'number' ? user.streak : 0,
  xp: typeof user.xp === 'number' ? user.xp : 0,
  dailyGoal: typeof user.dailyGoal === 'number' ? user.dailyGoal : 25,
  lastVisitDate: typeof user.lastVisitDate === 'number' ? user.lastVisitDate : Date.now(),
  subscriptionStatus: user.subscriptionStatus || 'ACTIVE',
  plan: user.plan || 'FREE',
  trialEndsAt: typeof user.trialEndsAt === 'number' ? user.trialEndsAt : 0,
  subscriptionEndsAt: typeof user.subscriptionEndsAt === 'number' ? user.subscriptionEndsAt : 0
});

async function withFallback<T>(
    firebaseOp: () => Promise<T>,
    localOp: () => T | Promise<T>
): Promise<T> {
    if (!isFirebaseReady()) {
        return localOp();
    }
    try {
        return await firebaseOp();
    } catch (err: any) {
        console.warn(`Firebase operation failed. Falling back to LocalStorage. Error: ${err.message}`);
        lastFirebaseError = err.message;
        return localOp();
    }
}

// --- Global Dictionary Cache Services ---

export const getCachedDefinition = async (word: string): Promise<DefinitionResponse | null> => {
    const normalized = word.toLowerCase().trim();
    return withFallback(
        async () => {
            const docRef = doc(db!, DICT_CACHE_COL, normalized);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? (docSnap.data() as DefinitionResponse) : null;
        },
        () => {
            const dictStr = localStorage.getItem(LOCAL_KEYS.GLOBAL_DICT);
            const dict = dictStr ? JSON.parse(dictStr) : {};
            return dict[normalized] || null;
        }
    );
};

export const saveDefinitionToCache = async (word: string, definition: DefinitionResponse) => {
    const normalized = word.toLowerCase().trim();
    return withFallback(
        async () => await setDoc(doc(db!, DICT_CACHE_COL, normalized), definition),
        () => {
            const dictStr = localStorage.getItem(LOCAL_KEYS.GLOBAL_DICT);
            const dict = dictStr ? JSON.parse(dictStr) : {};
            dict[normalized] = definition;
            localStorage.setItem(LOCAL_KEYS.GLOBAL_DICT, JSON.stringify(dict));
        }
    );
};

// --- Existing Storage Logic ---

export const initStorage = async () => {
  const seedLocal = () => {
      if (!localStorage.getItem(LOCAL_KEYS.BOOKS)) {
          localStorage.setItem(LOCAL_KEYS.BOOKS, JSON.stringify(MOCK_BOOKS));
      }
      if (!localStorage.getItem(LOCAL_KEYS.PLANS)) {
          localStorage.setItem(LOCAL_KEYS.PLANS, JSON.stringify(DEFAULT_PLANS));
      }
  };

  await withFallback(
      async () => {
        const booksSnapshot = await getDocs(collection(db!, BOOKS_COL));
        if (booksSnapshot.empty) {
            for (const book of MOCK_BOOKS) {
                await setDoc(doc(db!, BOOKS_COL, book.id), book);
            }
        }
        const plansSnapshot = await getDocs(collection(db!, PLANS_COL));
        if (plansSnapshot.empty) {
            for (const plan of DEFAULT_PLANS) {
                await setDoc(doc(db!, PLANS_COL, plan.id), plan);
            }
        }
      },
      seedLocal
  );
};

export const getUsers = async (): Promise<User[]> => {
  return withFallback(
      async () => {
          const snapshot = await getDocs(collection(db!, USERS_COL));
          return snapshot.docs.map(d => normalizeBrowserUser(d.data() as User, d.id));
      },
      () => {
          const usersStr = localStorage.getItem(LOCAL_KEYS.USERS);
          const users: User[] = usersStr ? JSON.parse(usersStr) : [];
          return users.map(user => normalizeBrowserUser(user));
      }
  );
};

export const saveUser = async (user: User) => {
  // Browser profile updates are intentionally allow-listed. Sensitive account,
  // subscription, role, XP, and streak fields cannot be written by this path.
  const safeFields = {
    name: user.name.trim(),
    avatarUrl: user.avatarUrl || '',
    languagePreference: user.languagePreference,
    dailyGoal: user.dailyGoal,
    updatedAt: Date.now()
  };
  if (!db) throw new Error('Firebase profile storage is unavailable.');
  return setDoc(doc(db, USERS_COL, user.id), safeFields, { merge: true });
};

export const deleteUser = async (userId: string) => {
    if (!db) throw new Error('Admin mutations require a secured server backend.');
    return deleteDoc(doc(db, USERS_COL, userId));
};

export const loadOrCreateUserProfile = async (firebaseUser: FirebaseUser): Promise<User> => {
  if (!db) throw new Error('auth/profile-storage-unavailable');
  const ref = doc(db, USERS_COL, firebaseUser.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    const existing = normalizeBrowserUser(snapshot.data() as User, firebaseUser.uid);
    // Auth creation can notify the observer before updateProfile completes.
    // Repair only safe display fields when that race produced the placeholder.
    if (existing.name === 'ReadLex User' && firebaseUser.displayName) {
      const safeDisplayFields = {
        name: firebaseUser.displayName,
        avatarUrl: firebaseUser.photoURL || existing.avatarUrl || '',
        updatedAt: Date.now()
      };
      await setDoc(ref, safeDisplayFields, { merge: true });
      return { ...existing, ...safeDisplayFields };
    }
    return existing;
  }

  const now = Date.now();
  const created: User = {
    id: firebaseUser.uid,
    email: firebaseUser.email?.toLowerCase().trim() || '',
    name: firebaseUser.displayName || 'ReadLex User',
    avatarUrl: firebaseUser.photoURL || '',
    languagePreference: 'TR',
    role: 'USER',
    streak: 0,
    xp: 0,
    dailyGoal: 25,
    lastVisitDate: now,
    subscriptionStatus: 'ACTIVE',
    plan: 'FREE',
    trialEndsAt: 0,
    subscriptionEndsAt: 0
  };
  // setDoc is idempotent for the same canonical UID; a concurrent observer
  // can only create the same safe baseline document.
  await setDoc(ref, { ...created, createdAt: now, updatedAt: now });
  return created;
};

export const getBooks = async (): Promise<Book[]> => {
    return withFallback(
        () => getBookList(),
        () => {
            const booksStr = localStorage.getItem(LOCAL_KEYS.BOOKS);
            return booksStr ? JSON.parse(booksStr) : MOCK_BOOKS;
        }
    );
};

export const getBookById = async (bookId: string): Promise<Book | undefined> => {
  if (!db) {
    const books = await getBooks();
    return books.find(book => book.id === bookId);
  }
  try {
    return await getBookWithChapters(bookId);
  } catch (error: any) {
    lastFirebaseError = error.message;
    const books = await getBooks();
    return books.find(book => book.id === bookId);
  }
};

export const saveBook = async (book: Book) => {
    if (!db) throw new Error('Admin mutations require a secured server backend.');
    return setDoc(doc(db, BOOKS_COL, book.id), book);
};

export const deleteBook = async (bookId: string) => {
    if (!db) throw new Error('Admin mutations require a secured server backend.');
    return deleteDoc(doc(db, BOOKS_COL, bookId));
};

export const getPlans = async (): Promise<PlanConfig[]> => {
    return withFallback(
        async () => {
            const snapshot = await getDocs(collection(db!, PLANS_COL));
            const plans = snapshot.docs.map(d => d.data() as PlanConfig);
            return plans.length > 0 ? plans : DEFAULT_PLANS;
        },
        () => {
            const plansStr = localStorage.getItem(LOCAL_KEYS.PLANS);
            return plansStr ? JSON.parse(plansStr) : DEFAULT_PLANS;
        }
    );
};

export const savePlans = async (plans: PlanConfig[]) => {
    if (!db) throw new Error('Admin mutations require a secured server backend.');
    const batch = writeBatch(db);
    for (const plan of plans) {
        const ref = doc(db, PLANS_COL, plan.id);
        batch.set(ref, plan);
    }
    return batch.commit();
};

export const getUserVocab = async (userId: string): Promise<VocabularyWord[]> => {
    return withFallback(
        () => getVocabularyEntries(userId),
        () => {
            const vocabStr = localStorage.getItem(LOCAL_KEYS.VOCAB_PREFIX + userId);
            return vocabStr ? JSON.parse(vocabStr) : [];
        }
    );
};

export const saveUserVocab = async (userId: string, words: VocabularyWord[]): Promise<VocabularyWord> => {
    if (!words.length) throw new Error('Vocabulary entry is required.');
    // Compatibility wrapper for existing UI callers. New writes are individual
    // subcollection documents; legacy vocabulary/{uid} is never expanded.
    const newest = words[0];
    if (!db) {
      localStorage.setItem(LOCAL_KEYS.VOCAB_PREFIX + userId, JSON.stringify(words));
      return newest;
    }
    try {
      return await saveVocabularyEntry(userId, newest);
    } catch (error: any) {
      lastFirebaseError = error.message;
      localStorage.setItem(LOCAL_KEYS.VOCAB_PREFIX + userId, JSON.stringify(words));
      return newest;
    }
};

export const deleteUserVocab = async (userId: string, wordId: string, remainingWords: VocabularyWord[]) =>
  withFallback(
    () => deleteVocabularyEntry(userId, wordId),
    async () => localStorage.setItem(LOCAL_KEYS.VOCAB_PREFIX + userId, JSON.stringify(remainingWords))
  );

// HELPER: Normalize raw data to UserBookProgress objects
export const getUserProgress = async (userId: string): Promise<Record<string, UserBookProgress>> => {
    return withFallback(
        () => getProgressEntries(userId),
        () => {
            const progStr = localStorage.getItem(LOCAL_KEYS.PROGRESS_PREFIX + userId);
            return progStr ? JSON.parse(progStr) : {};
        }
    );
};

export const saveUserProgress = async (userId: string, progress: UserBookProgress) => {
    return withFallback(
        () => saveProgressEntry(userId, progress),
        async () => {
            const raw = localStorage.getItem(LOCAL_KEYS.PROGRESS_PREFIX + userId);
            const existing = raw ? JSON.parse(raw) as Record<string, UserBookProgress> : {};
            localStorage.setItem(LOCAL_KEYS.PROGRESS_PREFIX + userId, JSON.stringify({ ...existing, [progress.bookId]: progress }));
        }
    );
};
