// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFirebaseAuthSession } from '../hooks/useFirebaseAuthSession';
import { User } from '../types';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
};

const profile = (id: string): User => ({
  id,
  email: `${id}@example.test`,
  name: id,
  languagePreference: 'TR' as const,
  role: 'USER' as const,
  streak: 0,
  xp: 0,
  dailyGoal: 25,
  lastVisitDate: 0,
  subscriptionStatus: 'ACTIVE',
  plan: 'FREE',
  trialEndsAt: 0,
  subscriptionEndsAt: 0,
});

describe('Firebase auth session lifecycle', () => {
  it('starts loading, then resolves an unauthenticated Firebase state without a profile request', async () => {
    let listener!: (user: any) => void;
    const loadProfile = vi.fn();
    let value: any;
    const Probe = () => { value = useFirebaseAuthSession({ observe: callback => { listener = callback; return () => undefined; }, loadProfile }); return null; };
    render(<Probe />);
    await act(async () => {});
    expect(value.status).toBe('AUTH_LOADING');
    await act(async () => listener(null));
    expect(value.status).toBe('UNAUTHENTICATED');
    expect(value.user).toBeNull();
    expect(loadProfile).not.toHaveBeenCalled();
  });

  it('loads the canonical Firebase user profile and clears it immediately on logout', async () => {
    let listener!: (user: any) => void;
    let value: any;
    const Probe = () => { value = useFirebaseAuthSession({ observe: callback => { listener = callback; return () => undefined; }, loadProfile: async user => profile(user.uid) }); return null; };
    render(<Probe />);
    await act(async () => {});
    await act(async () => listener({ uid: 'user-a' }));
    expect(value.status).toBe('AUTHENTICATED');
    expect(value.user.id).toBe('user-a');
    act(() => value.clearSession());
    expect(value.status).toBe('UNAUTHENTICATED');
    expect(value.user).toBeNull();
  });

  it('isolates a user switch and ignores the late profile response from user A', async () => {
    let listener!: (user: any) => void;
    const a = deferred<ReturnType<typeof profile>>();
    const b = deferred<ReturnType<typeof profile>>();
    const loadProfile = vi.fn((user: any) => user.uid === 'user-a' ? a.promise : b.promise);
    let value: any;
    const Probe = () => { value = useFirebaseAuthSession({ observe: callback => { listener = callback; return () => undefined; }, loadProfile }); return null; };
    render(<Probe />);
    await act(async () => {});
    await act(async () => { listener({ uid: 'user-a' }); });
    await act(async () => { listener({ uid: 'user-b' }); });
    expect(value.status).toBe('AUTH_LOADING');
    expect(value.user).toBeNull();
    await act(async () => b.resolve(profile('user-b')));
    expect(value.user.id).toBe('user-b');
    await act(async () => a.resolve(profile('user-a')));
    expect(value.status).toBe('AUTHENTICATED');
    expect(value.user.id).toBe('user-b');
  });

  it('invalidates pending callbacks when unmounted', async () => {
    let listener!: (user: any) => void;
    const pending = deferred<ReturnType<typeof profile>>();
    const unsubscribe = vi.fn();
    const Probe = () => { useFirebaseAuthSession({ observe: callback => { listener = callback; return unsubscribe; }, loadProfile: () => pending.promise }); return null; };
    const view = render(<Probe />);
    await act(async () => {});
    await act(async () => { listener({ uid: 'user-a' }); });
    view.unmount();
    await act(async () => pending.resolve(profile('user-a')));
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
