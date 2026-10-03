import { useCallback, useEffect, useRef, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { getAuthenticatedProfile, observeAuthState } from '../services/auth';
import { User } from '../types';

export type AuthSessionStatus = 'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

type AuthSessionDependencies = {
  observe: (listener: (user: FirebaseUser | null) => void) => () => void;
  loadProfile: (user: FirebaseUser) => Promise<User>;
};

const defaults: AuthSessionDependencies = {
  observe: observeAuthState,
  loadProfile: getAuthenticatedProfile,
};

export const useFirebaseAuthSession = (dependencies: AuthSessionDependencies = defaults) => {
  const [status, setStatus] = useState<AuthSessionStatus>('AUTH_LOADING');
  const [user, setUser] = useState<User | null>(null);
  const generation = useRef(0);

  const clearSession = useCallback(() => {
    generation.current += 1;
    setUser(null);
    setStatus('UNAUTHENTICATED');
  }, []);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = dependencies.observe(async (firebaseUser) => {
      const currentGeneration = ++generation.current;

      if (!firebaseUser) {
        if (mounted && currentGeneration === generation.current) clearSession();
        return;
      }

      // Never retain user A's profile while Firebase is resolving user B.
      if (mounted) {
        setUser(null);
        setStatus('AUTH_LOADING');
      }

      try {
        const profile = await dependencies.loadProfile(firebaseUser);
        if (mounted && currentGeneration === generation.current) {
          setUser(profile);
          setStatus('AUTHENTICATED');
        }
      } catch {
        if (mounted && currentGeneration === generation.current) clearSession();
      }
    });

    return () => {
      mounted = false;
      generation.current += 1;
      unsubscribe();
    };
  }, [clearSession, dependencies]);

  return { status, user, setUser, clearSession };
};
