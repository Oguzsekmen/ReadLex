import {
  AuthError,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { User } from '../types';
import { loadOrCreateUserProfile } from './storage';
import { isNativePlatform } from './native/platform';

const requireAuth = () => {
  if (!auth) throw new Error('auth/not-configured');
  return auth;
};

export const signUpWithEmail = async (name: string, email: string, password: string) => {
  const credential = await createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
  await updateProfile(credential.user, { displayName: name.trim() });
  await sendEmailVerification(credential.user);
  await loadOrCreateUserProfile(credential.user);
  return credential.user;
};

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(requireAuth(), email.trim(), password);

export const signInWithGoogle = () => {
  if (!auth || !googleProvider) throw new Error('auth/not-configured');
  // Popup OAuth is a browser flow. A future native adapter can replace this
  // branch without introducing credentials into the application bundle.
  if (isNativePlatform()) throw new Error('auth/native-google-sign-in-not-configured');
  return signInWithPopup(auth, googleProvider);
};

export const signOutUser = () => signOut(requireAuth());

export const sendPasswordReset = (email: string) =>
  sendPasswordResetEmail(requireAuth(), email.trim());

export const sendVerificationEmail = () => {
  const currentUser = requireAuth().currentUser;
  if (!currentUser) throw new Error('auth/no-current-user');
  return sendEmailVerification(currentUser);
};

export const getAuthenticatedProfile = async (firebaseUser: FirebaseUser): Promise<User> => {
  const profile = await loadOrCreateUserProfile(firebaseUser);
  // Roles come only from a signed Firebase ID token, never a profile document.
  const token = await firebaseUser.getIdTokenResult();
  return {
    ...profile,
    role: token.claims.admin === true ? 'ADMIN' : 'USER',
    emailVerified: firebaseUser.emailVerified
  };
};

// Call after an owner assigns a custom claim; this intentionally forces a
// single token refresh rather than refreshing tokens during normal rendering.
export const refreshAuthenticatedProfile = async (): Promise<User> => {
  const firebaseUser = requireAuth().currentUser;
  if (!firebaseUser) throw new Error('auth/no-current-user');
  await firebaseUser.getIdTokenResult(true);
  return getAuthenticatedProfile(firebaseUser);
};

export const observeAuthState = (listener: (firebaseUser: FirebaseUser | null) => void) => {
  if (!auth) {
    queueMicrotask(() => listener(null));
    return () => undefined;
  }
  return onAuthStateChanged(auth, listener);
};

export const getAuthErrorMessage = (error: unknown, language: 'TR' | 'EN' = 'TR') => {
  const code = (error as AuthError | undefined)?.code || (error as Error | undefined)?.message || '';
  const tr: Record<string, string> = {
    'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanımda.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/user-not-found': 'E-posta veya şifre hatalı.',
    'auth/wrong-password': 'E-posta veya şifre hatalı.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalıdır.',
    'auth/invalid-email': 'Geçerli bir e-posta adresi girin.',
    'auth/network-request-failed': 'Ağ bağlantısı kurulamadı. Lütfen tekrar deneyin.',
    'auth/popup-closed-by-user': 'Google giriş penceresi kapatıldı.',
    'auth/popup-blocked': 'Google giriş penceresi tarayıcı tarafından engellendi.',
    'auth/native-google-sign-in-not-configured': 'Google ile giriş mobil uygulamada henüz yapılandırılmadı. E-posta ile giriş yapabilirsiniz.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.',
    'auth/not-configured': 'Firebase yapılandırması mevcut değil.',
    'auth/no-current-user': 'Doğrulama e-postası için aktif bir kullanıcı bulunamadı.'
  };
  if (language === 'TR') return tr[code] || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
  return 'The request could not be completed. Please try again.';
};
