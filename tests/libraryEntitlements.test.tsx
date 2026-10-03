// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Library from '../components/Library';
import { freeEntitlements } from '../services/entitlements';

const user: any = { id: 'u', name: 'Ada', languagePreference: 'EN', plan: 'YEARLY', subscriptionStatus: 'ACTIVE', streak: 0, xp: 0, dailyGoal: 25 };
const books: any[] = [
  { id: 'free', title: 'Free book', author: 'A', level: 'A1', coverUrl: '', excerpt: '', totalWords: 1, requiredPlan: ['FREE'], archived: false },
  { id: 'premium', title: 'Premium book', author: 'A', level: 'A1', coverUrl: '', excerpt: '', totalWords: 1, requiredPlan: ['PREMIUM'], archived: false },
  { id: 'legacy-trial', title: 'Legacy trial book', author: 'A', level: 'A1', coverUrl: '', excerpt: '', totalWords: 1, requiredPlan: ['TRAILER'], archived: false },
];
const renderLibrary = (entitlement = freeEntitlements, loading = false) => render(<Library books={books} progressMap={{}} onSelectBook={() => undefined} user={user} entitlement={entitlement} entitlementLoading={loading} />);

describe('Library entitlement access', () => {
  afterEach(cleanup);

  it('keeps free books available but locks premium and legacy paid-plan books for a normalized free entitlement', () => {
    renderLibrary();
    expect(screen.getByRole('button', { name: 'Start Reading' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getAllByRole('button', { name: 'Locked' })).toHaveLength(2);
  });

  it('unlocks premium books only with the server-provided PREMIUM entitlement', () => {
    renderLibrary({ ...freeEntitlements, effectivePlan: 'PREMIUM', entitlements: ['FREE', 'PREMIUM'], isPremium: true, isTrialing: true, status: 'TRIALING' });
    expect(screen.queryByRole('button', { name: 'Locked' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Start Reading' })).toHaveLength(3);
  });

  it('fails closed for premium books while an entitlement request is loading', () => {
    renderLibrary({ ...freeEntitlements, effectivePlan: 'PREMIUM', entitlements: ['FREE', 'PREMIUM'], isPremium: true }, true);
    expect(screen.getAllByRole('button', { name: 'Locked' })).toHaveLength(2);
    expect(screen.getAllByText('Üyelik doğrulanıyor')).toHaveLength(2);
  });
});
