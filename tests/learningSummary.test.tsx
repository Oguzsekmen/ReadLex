// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LearningSummary } from '../components/LearningSummary';
import { emptyLearningSummary } from '../services/learning/statsService';

describe('LearningSummary', () => {
  afterEach(cleanup);
  it('renders safe empty-user metrics', () => { render(<LearningSummary summary={emptyLearningSummary} dailyGoal={5} vocabulary={[]} />); expect(screen.getByLabelText('Öğrenme özeti').textContent).toContain('0 XP'); expect(screen.getByText('0 / 5')).toBeTruthy(); });
  it('renders XP, streak, daily goal, mastered and weak vocabulary counts', () => { const view = render(<LearningSummary summary={{ ...emptyLearningSummary, totalXp: 30, currentStreak: 4, reviewedToday: 3 }} dailyGoal={5} vocabulary={[{ strength: 5 }, { strength: 2 }] as any} />); expect(screen.getByText('30 XP')).toBeTruthy(); expect(view.container.textContent).toContain('4gün seri'); expect(screen.getByText('3 / 5')).toBeTruthy(); expect(view.container.textContent).toContain('1öğrenildi'); expect(view.container.textContent).toContain('1zayıf kelime'); });
});
