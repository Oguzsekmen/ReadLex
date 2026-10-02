import { httpsCallable } from 'firebase/functions';
import { Book, PlanConfig } from '../types';
import { functions } from './firebase';

export interface AdminUserSummary {
  id: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  disabled: boolean;
  isAdmin: boolean;
}

const callable = <TRequest, TResponse>(name: string, data: TRequest) => {
  if (!functions) throw new Error('functions/not-configured');
  return httpsCallable<TRequest, TResponse>(functions, name)(data).then(result => result.data);
};

export const adminApi = {
  createBook: (book: Omit<Book, 'id' | 'totalWords'>) => callable('createBook', book),
  updateBook: (book: Book) => callable('updateBook', book),
  archiveBook: (id: string, archived: boolean) => callable('archiveBook', { id, archived }),
  deleteBook: (id: string) => callable('deleteBook', { id }),
  createPlan: (plan: PlanConfig) => callable('createPlan', plan),
  updatePlan: (plan: PlanConfig) => callable('updatePlan', plan),
  deletePlan: (id: string) => callable('deletePlan', { id }),
  listUsers: () => callable<Record<string, never>, { users: AdminUserSummary[] }>('listUsers', {})
};

export const getAdminApiErrorMessage = (error: unknown) => {
  const code = (error as { code?: string } | undefined)?.code || '';
  const messages: Record<string, string> = {
    'functions/unauthenticated': 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.',
    'functions/permission-denied': 'Bu yönetici işlemi için yetkiniz yok.',
    'functions/invalid-argument': 'Girilen yönetim verisi geçerli değil.',
    'functions/not-found': 'İstenen kayıt bulunamadı.',
    'functions/already-exists': 'Bu kimlikte bir kayıt zaten var.',
    'functions/not-configured': 'Yönetim hizmeti yapılandırılmamış.'
  };
  return messages[code] || 'Yönetim işlemi tamamlanamadı. Lütfen tekrar deneyin.';
};
