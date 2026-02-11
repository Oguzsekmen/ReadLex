
import { Book, User, VocabularyWord, BookStatus, PlanConfig, DefinitionResponse, UserBookProgress } from '../types';
import { MOCK_BOOKS, DEFAULT_PLANS } from './data';
import { db } from './firebase';

// Collection Names
const USERS_COL = 'users';
const BOOKS_COL = 'books';
const PLANS_COL = 'plans';
const VOCAB_COL = 'vocabulary';
const PROGRESS_COL = 'progress';
const DICT_CACHE_COL = 'dictionary_cache'; // Yeni: Global çeviri önbelleği

// Local Storage Keys
const LOCAL_KEYS = {
  USERS: 'readlex_users',
  BOOKS: 'readlex_books',
  PLANS: 'readlex_plans',
  VOCAB_PREFIX: 'readlex_vocab_',
  PROGRESS_PREFIX: 'readlex_progress_',
  GLOBAL_DICT: 'readlex_global_dict' // Yeni: Yerel çeviri önbelleği
};

const SESSION_KEY = 'readlex_session_uid';

const isFirebaseReady = () => !!db;

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
        console.warn(`Firebase operation failed. Falling back to LocalStorage.`);
        return localOp();
    }
}

// --- Global Dictionary Cache Services ---

export const getCachedDefinition = async (word: string): Promise<DefinitionResponse | null> => {
    const normalized = word.toLowerCase().trim();
    return withFallback(
        async () => {
            const doc = await db!.collection(DICT_CACHE_COL).doc(normalized).get();
            return doc.exists ? (doc.data() as DefinitionResponse) : null;
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
        async () => await db!.collection(DICT_CACHE_COL).doc(normalized).set(definition),
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
  const adminUser: User = {
    id: 'admin-oguz',
    email: 'oguzsekmen@readlex.com',
    name: 'Oguz Sekmen',
    password: 'Oguzsekmen', 
    avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Oguz',
    languagePreference: 'TR',
    role: 'ADMIN',
    streak: 999,
    xp: 99999,
    dailyGoal: 50,
    lastVisitDate: Date.now(),
    subscriptionStatus: 'ACTIVE',
    plan: 'YEARLY', 
    trialEndsAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    subscriptionEndsAt: Date.now() + 365 * 24 * 60 * 60 * 1000
  };

  const devAdmin: User = {
    id: 'admin-dev',
    email: 'a',
    name: 'Dev Admin',
    password: 'a',
    avatarUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=Admin',
    languagePreference: 'TR',
    role: 'ADMIN',
    streak: 100,
    xp: 5000,
    dailyGoal: 20,
    lastVisitDate: Date.now(),
    subscriptionStatus: 'ACTIVE',
    plan: 'YEARLY',
    trialEndsAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    subscriptionEndsAt: Date.now() + 365 * 24 * 60 * 60 * 1000
  };

  const defaultUsers = [adminUser, devAdmin];

  const seedLocal = () => {
      if (!localStorage.getItem(LOCAL_KEYS.BOOKS)) {
          localStorage.setItem(LOCAL_KEYS.BOOKS, JSON.stringify(MOCK_BOOKS));
      }
      if (!localStorage.getItem(LOCAL_KEYS.PLANS)) {
          localStorage.setItem(LOCAL_KEYS.PLANS, JSON.stringify(DEFAULT_PLANS));
      }
      const usersStr = localStorage.getItem(LOCAL_KEYS.USERS);
      let localUsers: User[] = usersStr ? JSON.parse(usersStr) : [];
      
      defaultUsers.forEach(defUser => {
        if (!localUsers.find(u => u.email.toLowerCase() === defUser.email.toLowerCase())) {
            localUsers.push(defUser);
        }
      });
      localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(localUsers));
  };

  await withFallback(
      async () => {
        const booksSnapshot = await db!.collection(BOOKS_COL).get();
        if (booksSnapshot.empty) {
            for (const book of MOCK_BOOKS) {
                await db!.collection(BOOKS_COL).doc(book.id).set(book);
            }
        }
        const plansSnapshot = await db!.collection(PLANS_COL).get();
        if (plansSnapshot.empty) {
            for (const plan of DEFAULT_PLANS) {
                await db!.collection(PLANS_COL).doc(plan.id).set(plan);
            }
        }
        
        for (const defUser of defaultUsers) {
            const adminQuery = await db!.collection(USERS_COL).where('email', '==', defUser.email).get();
            if (adminQuery.empty) {
                await db!.collection(USERS_COL).doc(defUser.id).set(defUser);
            }
        }
      },
      seedLocal
  );
};

export const getUsers = async (): Promise<User[]> => {
  return withFallback(
      async () => {
          const snapshot = await db!.collection(USERS_COL).get();
          return snapshot.docs.map(d => d.data() as User);
      },
      () => {
          const usersStr = localStorage.getItem(LOCAL_KEYS.USERS);
          return usersStr ? JSON.parse(usersStr) : [];
      }
  );
};

export const saveUser = async (user: User) => {
  const normalizedUser = { ...user, email: user.email.toLowerCase().trim() };
  return withFallback(
      async () => await db!.collection(USERS_COL).doc(normalizedUser.id).set(normalizedUser),
      async () => {
          const users = await getUsers();
          const index = users.findIndex(u => u.id === normalizedUser.id);
          if (index >= 0) users[index] = normalizedUser;
          else users.push(normalizedUser);
          localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(users));
      }
  );
};

export const deleteUser = async (userId: string) => {
    return withFallback(
        async () => await db!.collection(USERS_COL).doc(userId).delete(),
        async () => {
            const users = await getUsers();
            const filtered = users.filter(u => u.id !== userId);
            localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(filtered));
        }
    );
};

export const getUserByEmail = async (email: string): Promise<User | undefined> => {
    const normalizedEmail = email.toLowerCase().trim();
    return withFallback(
        async () => {
            const snapshot = await db!.collection(USERS_COL).where("email", "==", normalizedEmail).get();
            if (snapshot.empty) return undefined;
            return snapshot.docs[0].data() as User;
        },
        async () => {
            const users = await getUsers();
            return users.find(u => u.email.toLowerCase() === normalizedEmail);
        }
    );
};

export const getUserById = async (id: string): Promise<User | undefined> => {
    return withFallback(
        async () => {
            const docSnap = await db!.collection(USERS_COL).doc(id).get();
            return docSnap.exists ? (docSnap.data() as User) : undefined;
        },
        async () => {
            const users = await getUsers();
            return users.find(u => u.id === id);
        }
    );
};

export const saveSession = (userId: string) => {
  localStorage.setItem(SESSION_KEY, userId);
};

export const getSession = (): string | null => {
  return localStorage.getItem(SESSION_KEY);
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const getBooks = async (): Promise<Book[]> => {
    return withFallback(
        async () => {
            const snapshot = await db!.collection(BOOKS_COL).get();
            return snapshot.docs.map(d => d.data() as Book);
        },
        () => {
            const booksStr = localStorage.getItem(LOCAL_KEYS.BOOKS);
            return booksStr ? JSON.parse(booksStr) : MOCK_BOOKS;
        }
    );
};

export const saveBook = async (book: Book) => {
    return withFallback(
        async () => await db!.collection(BOOKS_COL).doc(book.id).set(book),
        async () => {
            const books = await getBooks();
            const index = books.findIndex(b => b.id === book.id);
            if (index >= 0) books[index] = book;
            else books.push(book);
            localStorage.setItem(LOCAL_KEYS.BOOKS, JSON.stringify(books));
        }
    );
};

export const deleteBook = async (bookId: string) => {
    return withFallback(
        async () => await db!.collection(BOOKS_COL).doc(bookId).delete(),
        async () => {
            const books = await getBooks();
            const filtered = books.filter(b => b.id !== bookId);
            localStorage.setItem(LOCAL_KEYS.BOOKS, JSON.stringify(filtered));
        }
    );
};

export const getPlans = async (): Promise<PlanConfig[]> => {
    return withFallback(
        async () => {
            const snapshot = await db!.collection(PLANS_COL).get();
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
    return withFallback(
        async () => {
            const batch = db!.batch();
            for (const plan of plans) {
                const ref = db!.collection(PLANS_COL).doc(plan.id);
                batch.set(ref, plan);
            }
            await batch.commit();
        },
        () => {
            localStorage.setItem(LOCAL_KEYS.PLANS, JSON.stringify(plans));
        }
    );
};

export const getUserVocab = async (userId: string): Promise<VocabularyWord[]> => {
    return withFallback(
        async () => {
            const docSnap = await db!.collection(VOCAB_COL).doc(userId).get();
            return docSnap.exists ? docSnap.data()?.words : [];
        },
        () => {
            const vocabStr = localStorage.getItem(LOCAL_KEYS.VOCAB_PREFIX + userId);
            return vocabStr ? JSON.parse(vocabStr) : [];
        }
    );
};

export const saveUserVocab = async (userId: string, words: VocabularyWord[]) => {
    return withFallback(
        async () => await db!.collection(VOCAB_COL).doc(userId).set({ words }),
        async () => {
            localStorage.setItem(LOCAL_KEYS.VOCAB_PREFIX + userId, JSON.stringify(words));
        }
    );
};

// HELPER: Normalize raw data to UserBookProgress objects
const normalizeProgressData = (data: any): Record<string, UserBookProgress> => {
    const normalized: Record<string, UserBookProgress> = {};
    if (!data) return normalized;

    for (const key in data) {
        if (typeof data[key] === 'string') {
            // Convert Legacy String Status to Object
            normalized[key] = {
                bookId: key,
                status: data[key] as BookStatus,
                currentChapterIndex: data[key] === 'COMPLETED' ? 999 : 0,
                lastReadAt: new Date()
            };
        } else {
            // Already an object, ensure all fields exist
            normalized[key] = {
                ...data[key],
                lastWordIndex: data[key].lastWordIndex || 0
            };
        }
    }
    return normalized;
};

export const getUserProgress = async (userId: string): Promise<Record<string, UserBookProgress>> => {
    return withFallback(
        async () => {
            const docSnap = await db!.collection(PROGRESS_COL).doc(userId).get();
            const rawData = docSnap.exists ? docSnap.data()?.progress : {};
            return normalizeProgressData(rawData);
        },
        () => {
            const progStr = localStorage.getItem(LOCAL_KEYS.PROGRESS_PREFIX + userId);
            const rawData = progStr ? JSON.parse(progStr) : {};
            return normalizeProgressData(rawData);
        }
    );
};

export const saveUserProgress = async (userId: string, progress: Record<string, UserBookProgress>) => {
    return withFallback(
        async () => await db!.collection(PROGRESS_COL).doc(userId).set({ progress }),
        async () => {
            localStorage.setItem(LOCAL_KEYS.PROGRESS_PREFIX + userId, JSON.stringify(progress));
        }
    );
};
