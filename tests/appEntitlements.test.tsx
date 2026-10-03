// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dashboard } from '../App';
import { emptyLearningSummary } from '../services/learning/statsService';
import { freeEntitlements } from '../services/entitlements';

const user: any = { id: 'u', name: 'Ada', languagePreference: 'TR', plan: 'MONTHLY', subscriptionStatus: 'TRIAL', trialEndsAt: 0, streak: 0, xp: 0, dailyGoal: 25 };

describe('App entitlement integration', () => {
  afterEach(cleanup);

  it('renders membership from the normalized entitlement, not legacy profile trial/plan fields', () => {
    render(<Dashboard user={user} vocabCount={0} vocabulary={[]} wordsAddedToday={0} onStartQuiz={() => undefined} books={[]} bookProgress={{}} onContinueBook={() => undefined} onNavigateToLibrary={() => undefined} learningSummary={emptyLearningSummary} entitlement={freeEntitlements} />);
    expect(screen.getByText('ÜCRETSİZ PLAN')).toBeTruthy();
    expect(screen.queryByText(/Days left/i)).toBeNull();
  });

  it('shows premium only when the normalized backend entitlement is premium', () => {
    render(<Dashboard user={{ ...user, plan: 'FREE', subscriptionStatus: 'ACTIVE' }} vocabCount={0} vocabulary={[]} wordsAddedToday={0} onStartQuiz={() => undefined} books={[]} bookProgress={{}} onContinueBook={() => undefined} onNavigateToLibrary={() => undefined} learningSummary={emptyLearningSummary} entitlement={{ ...freeEntitlements, effectivePlan: 'PREMIUM', entitlements: ['FREE', 'PREMIUM'], isPremium: true, status: 'ACTIVE' }} />);
    expect(screen.getByText('PREMIUM')).toBeTruthy();
  });
});
